import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2, ShieldCheck, MapPin, ArrowRight, CheckCircle2,
  Package, Phone, Hash, ChevronRight, Layers, Building2, Users, Navigation, LogOut,
  AlertCircle, Send,
} from "lucide-react";
import { formatNaira } from "@/lib/format";
import { QRCodeSVG } from "qrcode.react";
import { custodianApi, publicHandoverApi, publicWaybillApi, ACTOR_LABELS, type ActorType, type RunShipmentItem, type CustodySessionSummary } from "@/services/handover";
import { PublicNav } from "@/components/layout/PublicNav";
import { PhoneInput } from "@/components/PhoneInput";
import { savePhoneToken, getPhoneToken, clearPhoneToken } from "@/lib/custodianPhoneToken";

type Phase =
  | "loading"
  | "find-phone"
  | "find-otp"
  | "session-picker"
  | "phone"
  | "otp"
  | "custody"
  | "run-custody"
  | "actor-select"
  | "qr"
  | "delivery-otp"   // final-mile delivery — OTP to receiver phone on waybill
  | "success"
  | "error";

const STAFF_ACTOR_OPTIONS: { type: ActorType; label: string; description: string }[] = [
  { type: "ACTOR_COURIER",  label: "Driver / Courier",       description: "Hand to a driver for delivery" },
  { type: "ACTOR_HUB",      label: "Another staff member",   description: "Internal transfer within your hub" },
  { type: "ACTOR_RECEIVER", label: "Final recipient",        description: "Deliver directly to the customer" },
];

export default function StaffHandoverPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("ref") || "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [custodianToken, setCustodianToken] = useState<string | null>(null);

  // Find-my-custody picker — populated after verify-otp-by-phone
  const [discoveredSessions, setDiscoveredSessions] = useState<CustodySessionSummary[]>([]);

  const [custody, setCustody] = useState<{
    name: string;
    actorType: ActorType;
    shipment?: { goodsDescription: string; pickupLocation: string; deliveryLocation: string };
    waybillId?: string | null;
    waybillNumber?: string | null;
    mode?: "run";
    runId?: string;
    shipments?: RunShipmentItem[];
    startedAt?: string;
    progress?: {
      total: number; delivered: number; remaining: number;
      totalValue: number; remainingValue: number;
    };
  } | null>(null);

  const [activeRunShipment, setActiveRunShipment] = useState<RunShipmentItem | null>(null);

  const [waybillChain, setWaybillChain] = useState<Array<{
    id: string;
    giverActorType: ActorType;
    receiverActorType: ActorType;
    proofHash: string;
    occurredAt: string;
  }>>([]);

  const [receiverActorType, setReceiverActorType] = useState<ActorType>("ACTOR_COURIER");
  const [handoverToken, setHandoverToken] = useState<string | null>(null);
  const [, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const secondsLeftRef = useRef(secondsLeft);
  useEffect(() => { secondsLeftRef.current = secondsLeft; }, [secondsLeft]);

  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qrError, setQrError] = useState("");
  const [bulkMode, setBulkMode] = useState(false);

  // Final-mile delivery OTP — staff member enters the code the recipient
  // reads aloud. No QR scan involved.
  const [otpRequesting, setOtpRequesting] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpMaskedPhone, setOtpMaskedPhone] = useState("");
  const [otpChannel, setOtpChannel] = useState<"sms" | "email" | "none">("none");
  const [otpReceiverName, setOtpReceiverName] = useState<string | null>(null);
  const [otpGoodsDescription, setOtpGoodsDescription] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  const scanUrl = handoverToken
    ? `${window.location.origin}/scan?token=${handoverToken}`
    : null;

  useEffect(() => {
    if (sessionId) { setPhase("phone"); return; }

    // Auto-resume from a saved phone token if we have one
    const saved = getPhoneToken();
    if (!saved) { setPhase("find-phone"); return; }

    custodianApi.sessionsByPhoneToken(saved)
      .then((result) => {
        setDiscoveredSessions(result.sessions || []);
        setPhone(result.phone || "");
        setPhase("session-picker");
      })
      .catch(() => {
        clearPhoneToken();
        setPhase("find-phone");
      });
  }, [sessionId]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await custodianApi.requestOtp({ sessionId, phone });
      setPhase("otp");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Could not send OTP.");
      setPhase("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await custodianApi.verifyOtp({ sessionId, otp });
      setCustodianToken(result.token);
      const info = await custodianApi.getMe(result.token);
      setCustody(info);
      if (info.mode === "run") {
        setPhase("run-custody");
      } else {
        if (info.waybillId) {
          publicWaybillApi.getChain(info.waybillId)
            .then((data: { chain: typeof waybillChain }) => setWaybillChain(data.chain))
            .catch(() => {});
        }
        setPhase("custody");
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Find-my-custody flow ──────────────────────────────────────────────────

  async function handleRequestOtpByPhone(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await custodianApi.requestOtpByPhone(phone);
      setOtp("");
      setPhase("find-otp");
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not send code. Check the number and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtpByPhone(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await custodianApi.verifyOtpByPhone(phone, otp);
      setDiscoveredSessions(result.sessions || []);
      if (result.phoneToken) savePhoneToken(result.phoneToken);
      setPhase("session-picker");
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Invalid or expired code."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function openDiscoveredSession(session: CustodySessionSummary) {
    setCustodianToken(session.token);
    try {
      const info = await custodianApi.getMe(session.token);
      setCustody(info);
      if (info.mode === "run") {
        setPhase("run-custody");
      } else {
        if (info.waybillId) {
          publicWaybillApi.getChain(info.waybillId)
            .then((data: { chain: typeof waybillChain }) => setWaybillChain(data.chain))
            .catch(() => {});
        }
        setPhase("custody");
      }
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not load this custody session."
      );
    }
  }

  async function handleGenerateQr(shipmentId?: string) {
    if (!custodianToken) return;
    setSubmitting(true);
    setQrError("");
    try {
      let result;
      if (bulkMode) {
        result = await custodianApi.initiateBulkHandover(custodianToken, receiverActorType);
      } else {
        result = await custodianApi.initiateHandover(custodianToken, receiverActorType, shipmentId);
      }
      setHandoverToken(result.token);
      setExpiresAt(result.expiresAt);
      const secs = Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000);
      setSecondsLeft(secs);

      // Final-mile delivery: skip QR, send OTP to the receiver phone on
      // the waybill and let the staff member enter the code.
      if (receiverActorType === "ACTOR_RECEIVER" && !bulkMode) {
        setOtpRequested(false);
        setOtpCode("");
        setOtpError("");
        setPhase("delivery-otp");
        await sendDeliveryOtp(result.token);
      } else {
        setPhase("qr");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not generate handover code. Check your connection and try again.";
      setQrError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendDeliveryOtp(token: string) {
    setOtpRequesting(true);
    setOtpError("");
    try {
      const result = await publicHandoverApi.requestDeliveryOtp(token);
      if (!result.sent) {
        setOtpError("Could not send the code. Check the phone number on the waybill is correct.");
        return;
      }
      setOtpMaskedPhone(result.maskedPhone);
      setOtpChannel(result.channel);
      setOtpReceiverName(result.receiverName);
      setOtpGoodsDescription(result.goodsDescription);
      setOtpRequested(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || "Could not send the code. Try again.";
      setOtpError(msg);
    } finally {
      setOtpRequesting(false);
    }
  }

  async function handleConfirmDelivery(e: React.FormEvent) {
    e.preventDefault();
    if (!handoverToken) return;
    if (otpCode.trim().length < 4) {
      setOtpError("Enter the 6-digit code the customer received.");
      return;
    }
    setOtpSubmitting(true);
    setOtpError("");
    try {
      await publicHandoverApi.confirm({
        token: handoverToken,
        receiverName: otpReceiverName || "Recipient",
        receiverActorType: "ACTOR_RECEIVER",
        otp: otpCode.trim(),
      });
      setConfirmed(true);
      setPhase("success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || "Could not confirm delivery. Check the code and try again.";
      setOtpError(msg);
    } finally {
      setOtpSubmitting(false);
    }
  }

  async function handleRunShipmentHandover(item: RunShipmentItem) {
    setBulkMode(false);
    setActiveRunShipment(item);
    setReceiverActorType("ACTOR_COURIER");
    setPhase("actor-select");
  }

  async function refreshRunCustody() {
    if (!custodianToken) return;
    try {
      const info = await custodianApi.getMe(custodianToken);
      setCustody(info);
      if (!info.shipments?.length) {
        setPhase("success");
      }
    } catch {
      // silently ignore
    }
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const selectedActor = STAFF_ACTOR_OPTIONS.find((o) => o.type === receiverActorType);

  return (
    <div className="min-h-screen bg-[#060d18] text-white flex flex-col">
      <PublicNav />
      <main className="flex-1 flex flex-col px-4 pt-24 pb-12 max-w-md mx-auto w-full">

        {/* Find-my-custody — phase 1: enter phone */}
        {phase === "find-phone" && (
          <form onSubmit={handleRequestOtpByPhone} className="space-y-5">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-9 w-9 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <Users className="h-4.5 w-4.5 text-orange-400" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-white">Staff handover</h1>
                  <p className="text-[11px] text-stone-500">Find your custody</p>
                </div>
              </div>
              <p className="text-xs text-stone-400 mt-2">
                Enter your phone number. We'll send you a one-time code so you can see every custody session assigned to you.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-white block mb-1.5">
                Phone number <span className="text-red-500">*</span>
              </label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                required
                size="md"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 text-white h-11 text-sm font-semibold hover:bg-orange-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              Send code
            </button>
          </form>
        )}

        {/* Find-my-custody — phase 2: enter OTP */}
        {phase === "find-otp" && (
          <form onSubmit={handleVerifyOtpByPhone} className="space-y-5">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-9 w-9 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <Hash className="h-4.5 w-4.5 text-orange-400" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-white">Enter your code</h1>
                  <p className="text-[11px] text-stone-500">We sent it to {phone || "your phone"}</p>
                </div>
              </div>
              <p className="text-xs text-stone-400 mt-2">
                Check your SMS. If it doesn't arrive, we'll have sent it to the email on file instead.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-white block mb-1.5">
                6-digit code <span className="text-red-500">*</span>
              </label>
              <input
                required
                autoFocus
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full rounded-md border border-white/[0.08] bg-white/[0.06] px-3 h-11 text-center font-mono tracking-[0.4em] text-base text-white placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting || otp.length < 6}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 text-white h-11 text-sm font-semibold hover:bg-orange-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Verify
            </button>
            <button
              type="button"
              onClick={() => { clearPhoneToken(); setPhone(""); setOtp(""); setDiscoveredSessions([]); setError(""); setPhase("find-phone"); }}
              className="w-full text-xs text-stone-500 hover:text-stone-300 transition-colors"
            >
              Use a different phone number
            </button>
          </form>
        )}

        {/* Find-my-custody — phase 3: pick a session */}
        {phase === "session-picker" && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-9 w-9 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <Users className="h-4.5 w-4.5 text-orange-400" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-white">Your active custody</h1>
                  <p className="text-[11px] text-stone-500">
                    {discoveredSessions.length === 0
                      ? "No active sessions found"
                      : `${discoveredSessions.length} session${discoveredSessions.length !== 1 ? "s" : ""} assigned to ${phone}`}
                  </p>
                </div>
              </div>
            </div>

            {discoveredSessions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.03] py-10 text-center space-y-2">
                <div className="flex justify-center">
                  <div className="h-10 w-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
                    <Package className="h-5 w-5 text-stone-500" />
                  </div>
                </div>
                <p className="text-sm font-medium text-stone-300">No custody assigned to you</p>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  When an operator hands off a shipment to your phone, it'll show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {discoveredSessions.map((session) => (
                  <button
                    key={session.sessionId}
                    type="button"
                    onClick={() => openDiscoveredSession(session)}
                    className="w-full text-left rounded-lg border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-orange-500/30 p-4 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          {session.mode === "run" ? (
                            <Layers className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                          )}
                          <p className="text-xs font-semibold text-white">
                            {session.mode === "run"
                              ? `Run with ${session.remainingShipments ?? 0} shipment${session.remainingShipments !== 1 ? "s" : ""} remaining`
                              : (session.shipment?.goodsDescription || "Shipment")}
                          </p>
                        </div>
                        {session.mode === "run" ? (
                          session.pickupSample && session.deliverySample && (
                            <p className="text-[11px] text-stone-500 truncate flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {session.pickupSample} → {session.deliverySample}
                              {session.totalShipments && session.totalShipments > 1 ? " · +more" : ""}
                            </p>
                          )
                        ) : (
                          session.shipment && (
                            <p className="text-[11px] text-stone-500 truncate flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {session.shipment.pickupLocation} → {session.shipment.deliveryLocation}
                            </p>
                          )
                        )}
                        <p className="text-[10px] text-stone-600 mt-1">
                          Started {new Date(session.createdAt).toLocaleString("en-NG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-orange-500/[0.1] border border-orange-500/20 px-1.5 py-0.5 text-orange-300">
                            {ACTOR_LABELS[session.receiverActorType]}
                          </span>
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-stone-600 group-hover:text-orange-400 transition-colors shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => { clearPhoneToken(); setPhone(""); setOtp(""); setDiscoveredSessions([]); setError(""); setPhase("find-phone"); }}
              className="w-full text-xs text-stone-500 hover:text-stone-300 transition-colors"
            >
              Use a different phone number
            </button>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────── */}
        {phase === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-red-500/15 flex items-center justify-center">
              <Package className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-sm font-medium text-white">Something went wrong</p>
            <p className="text-xs text-stone-400 max-w-xs">{error}</p>
          </div>
        )}

        {/* ── Phone entry ──────────────────────────────────────────────── */}
        {phase === "phone" && (
          <form onSubmit={handleRequestOtp} className="space-y-5">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-9 w-9 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <Building2 className="h-4.5 w-4.5 text-orange-400" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-white">Staff verification</h1>
                  <p className="text-[11px] text-stone-500">Internal custody handover</p>
                </div>
              </div>
              <p className="text-xs text-stone-400 mt-2">
                Enter the phone number registered for this custody session. We'll send a one-time code to verify your identity.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-white block mb-1.5">
                Phone number <span className="text-red-500">*</span>
              </label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                required
                size="md"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 text-white h-11 text-sm font-semibold hover:bg-orange-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Send OTP
            </button>
          </form>
        )}

        {/* ── OTP entry ────────────────────────────────────────────────── */}
        {phase === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <h1 className="text-base font-semibold text-white">Enter your code</h1>
              <p className="text-xs text-stone-400 mt-1">
                A 6-digit code was sent to {phone}. It's valid for 10 minutes.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-white block mb-1.5">
                6-digit code <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                <input
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.06] pl-9 pr-3 h-10 text-sm text-white placeholder:text-stone-600 tracking-widest focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting || otp.length !== 6}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 text-white h-11 text-sm font-semibold hover:bg-orange-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Verify
            </button>
            <button
              type="button"
              onClick={() => { setPhase("phone"); setError(""); setOtp(""); }}
              className="w-full text-xs text-stone-400 underline underline-offset-2"
            >
              Use a different phone number
            </button>
          </form>
        )}

        {/* ── Custody card (single shipment) ───────────────────────────── */}
        {phase === "custody" && custody && (
          <div className="space-y-5">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-5 space-y-3">
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">In your custody</p>
              <p className="text-sm font-semibold text-white">{custody.shipment?.goodsDescription}</p>
              <p className="text-xs text-stone-400 flex items-center gap-1.5">
                <MapPin className="h-3 w-3 shrink-0" />
                {custody.shipment?.pickupLocation} → {custody.shipment?.deliveryLocation}
              </p>
              {custody.waybillNumber && (
                <p className="font-mono text-[11px] text-stone-400">
                  Waybill: {custody.waybillNumber}
                </p>
              )}
              <div className="border-t border-white/[0.06] pt-3 flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                <span className="text-xs text-orange-300 font-medium">
                  {custody.name} — {ACTOR_LABELS[custody.actorType]}
                </span>
              </div>
            </div>

            {waybillChain.length > 0 && (
              <div className="rounded-lg border border-orange-400/15 bg-white/[0.03] p-4 space-y-3">
                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                  Custody history ({waybillChain.length} event{waybillChain.length !== 1 ? "s" : ""})
                </p>
                <div className="relative">
                  <div className="absolute left-[13px] top-4 bottom-4 w-px bg-orange-500/15" />
                  <div className="space-y-2">
                    {waybillChain.map((event, idx) => (
                      <div key={event.id} className="relative flex gap-3 items-start">
                        <div className={[
                          "relative z-10 shrink-0 h-7 w-7 rounded-full border flex items-center justify-center text-[9px] font-bold",
                          idx === waybillChain.length - 1
                            ? "border-orange-400 bg-[#060d18] text-orange-400"
                            : "border-white/[0.06] bg-[#060d18] text-stone-400",
                        ].join(" ")}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0 py-0.5">
                          <p className="text-xs font-medium text-white truncate">{ACTOR_LABELS[event.receiverActorType]}</p>
                          <p className="text-[10px] text-stone-400">
                            {ACTOR_LABELS[event.giverActorType]}{" "}→ {ACTOR_LABELS[event.receiverActorType]}
                          </p>
                          <p className="font-mono text-[9px] text-stone-400/70 mt-0.5">
                            {event.proofHash.slice(0, 12)}… · {new Date(event.occurredAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setPhase("actor-select")}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 text-white h-11 text-sm font-semibold hover:bg-orange-700"
            >
              Transfer custody <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Run custody — multiple shipments ─────────────────────────── */}
        {phase === "run-custody" && custody?.mode === "run" && (() => {
          const progress = custody.progress;
          const remainingShipments = custody.shipments ?? [];
          const remainingCount = progress?.remaining ?? remainingShipments.length;
          const totalCount     = progress?.total ?? remainingShipments.length;
          const deliveredCount = progress?.delivered ?? 0;
          const pctDelivered   = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0;
          const startedAt = custody.startedAt ? new Date(custody.startedAt) : null;

          return (
            <div className="space-y-4">

              {/* Run header */}
              <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-orange-500/[0.08] to-white/[0.02] p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-orange-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{custody.name}</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {startedAt
                        ? `Received ${startedAt.toLocaleString("en-NG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                        : "Custody held at hub"}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-stone-400 font-medium">
                      {deliveredCount} of {totalCount} transferred
                    </span>
                    <span className="text-orange-300 font-semibold tabular-nums">{pctDelivered}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all"
                      style={{ width: `${pctDelivered}%` }}
                    />
                  </div>
                </div>

                {progress && progress.totalValue > 0 && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-stone-500 font-medium">At hub</p>
                      <p className="text-sm font-semibold text-orange-200 tabular-nums">{formatNaira(progress.remainingValue * 100)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-stone-500 font-medium">Total run value</p>
                      <p className="text-sm font-semibold text-stone-200 tabular-nums">{formatNaira(progress.totalValue * 100)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bulk transfer CTA */}
              {remainingCount > 1 && (
                <button
                  onClick={() => {
                    setBulkMode(true);
                    setActiveRunShipment(null);
                    setReceiverActorType("ACTOR_COURIER");
                    setPhase("actor-select");
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/[0.16] hover:border-orange-500/40 h-11 text-sm font-semibold text-orange-200 transition-all"
                >
                  <Layers className="h-4 w-4" />
                  Transfer all {remainingCount} at once
                </button>
              )}

              {/* Shipment cards */}
              {remainingShipments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-stone-600 uppercase tracking-[0.12em] px-1">
                    Still at hub
                  </p>
                  {remainingShipments.map((item) => {
                    const navUrl = item.deliveryLocation
                      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.deliveryLocation)}`
                      : null;
                    return (
                      <div
                        key={item.shipmentId}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {item.waybillNumber && (
                              <p className="text-[10px] font-mono font-semibold text-orange-300 mb-1">{item.waybillNumber}</p>
                            )}
                            <p className="text-sm font-semibold text-white">{item.goodsDescription || "Shipment"}</p>
                            {item.pickupLocation && item.deliveryLocation && (
                              <p className="text-[11px] text-stone-400 mt-1 flex items-center gap-1.5">
                                <MapPin className="h-3 w-3 shrink-0 text-stone-600" />
                                <span className="truncate">{item.pickupLocation} → {item.deliveryLocation}</span>
                              </p>
                            )}
                          </div>
                          {item.shipmentValue > 0 && (
                            <div className="text-right shrink-0">
                              <p className="text-[10px] text-stone-600 uppercase tracking-wide">Value</p>
                              <p className="text-xs font-semibold text-stone-200 tabular-nums">{formatNaira(item.shipmentValue * 100)}</p>
                            </div>
                          )}
                        </div>

                        {(item.recipientName || item.recipientPhone || navUrl) && (
                          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                            <div className="min-w-0 flex-1">
                              {item.recipientName && (
                                <p className="text-[11px] text-stone-500 truncate">
                                  <span className="text-stone-600">For: </span>
                                  <span className="text-stone-300 font-medium">{item.recipientName}</span>
                                </p>
                              )}
                            </div>
                            {item.recipientPhone && (
                              <a
                                href={`tel:${item.recipientPhone}`}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-emerald-500/[0.1] hover:border-emerald-500/30 hover:text-emerald-400 text-stone-400 transition-colors"
                                title={`Call ${item.recipientName || item.recipientPhone}`}
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {navUrl && (
                              <a
                                href={navUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-blue-500/[0.1] hover:border-blue-500/30 hover:text-blue-400 text-stone-400 transition-colors"
                                title="Open in Maps"
                              >
                                <Navigation className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => handleRunShipmentHandover(item)}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 text-white h-9 text-xs font-semibold hover:shadow-orange-500/20 hover:shadow-sm transition-all"
                        >
                          Transfer <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {remainingShipments.length === 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] py-10 text-center space-y-2">
                  <div className="flex justify-center">
                    <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-emerald-200">All shipments transferred</p>
                  <p className="text-xs text-emerald-400/70 max-w-xs mx-auto">
                    Nothing left in your custody for this run.
                  </p>
                </div>
              )}

              {/* Footer */}
              <button
                type="button"
                onClick={() => {
                  setCustody(null);
                  setCustodianToken(null);
                  setError("");
                  if (discoveredSessions.length > 0) {
                    setPhase("session-picker");
                  } else {
                    clearPhoneToken();
                    setPhone("");
                    setOtp("");
                    setPhase("find-phone");
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 pt-2 text-[11px] text-stone-500 hover:text-stone-300 transition-colors"
              >
                <LogOut className="h-3 w-3" />
                {discoveredSessions.length > 0 ? "Switch to another session" : "Sign out"}
              </button>
            </div>
          );
        })()}

        {/* ── Actor selection ──────────────────────────────────────────── */}
        {phase === "actor-select" && (
          <div className="space-y-5">
            <div>
              <h1 className="text-base font-semibold text-white">Who are you transferring to?</h1>
              <p className="text-xs text-stone-400 mt-1">Select who will receive custody of this shipment.</p>
            </div>
            {bulkMode && custody?.shipments && (
              <div className="rounded-lg border border-orange-400/15 bg-orange-500/10 px-3 py-2">
                <p className="text-[11px] text-orange-400 font-medium">
                  Bulk transfer — {custody.shipments.length} shipment{custody.shipments.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
            {!bulkMode && activeRunShipment && (
              <div className="rounded-lg border border-orange-400/15 bg-orange-500/10 px-3 py-2">
                <p className="text-[11px] text-orange-400 font-medium truncate">
                  {activeRunShipment.waybillNumber || activeRunShipment.goodsDescription}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2">
              {STAFF_ACTOR_OPTIONS
                // Final delivery is per-shipment only — hide it in bulk mode.
                .filter(({ type }) => !(bulkMode && type === "ACTOR_RECEIVER"))
                .map(({ type, label, description }) => (
                  <button
                    key={`${type}-${label}`}
                    onClick={() => setReceiverActorType(type)}
                    className={[
                      "rounded-md border px-4 py-3 text-left transition-colors",
                      receiverActorType === type
                        ? "border-orange-400 bg-orange-500/10"
                        : "border-white/[0.06] hover:border-orange-400/30",
                    ].join(" ")}
                  >
                    <p className={[
                      "text-sm font-medium",
                      receiverActorType === type ? "text-orange-300" : "text-stone-400",
                    ].join(" ")}>
                      {label}
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5">{description}</p>
                  </button>
                ))}
            </div>
            {qrError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                {qrError}
              </p>
            )}

            <button
              onClick={() => handleGenerateQr(activeRunShipment?.shipmentId)}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 text-white h-11 text-sm font-semibold hover:bg-orange-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Generate handover QR
            </button>
          </div>
        )}

        {/* ── Final-mile delivery OTP — staff enters the code recipient reads */}
        {phase === "delivery-otp" && (
          <form onSubmit={handleConfirmDelivery} className="space-y-5">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-9 w-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <Package className="h-4.5 w-4.5 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-white">Delivery confirmation</h1>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Ask the recipient for the code we just sent them.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-4 space-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-purple-300/70 font-semibold">Delivering to</p>
                <p className="text-sm font-semibold text-white mt-0.5">
                  {otpReceiverName || "Recipient on waybill"}
                </p>
              </div>
              {otpGoodsDescription && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-purple-300/70 font-semibold">Goods</p>
                  <p className="text-xs text-purple-100 mt-0.5">{otpGoodsDescription}</p>
                </div>
              )}
            </div>

            {otpRequesting && !otpRequested ? (
              <div className="rounded-lg border border-orange-500/20 bg-orange-500/[0.06] p-4 flex items-center gap-2.5">
                <Loader2 className="h-4 w-4 text-orange-400 animate-spin shrink-0" />
                <p className="text-xs text-orange-200">Sending code to the recipient…</p>
              </div>
            ) : otpRequested ? (
              <div className="rounded-lg border border-green-500/20 bg-green-500/[0.06] p-3">
                <p className="text-[11px] text-green-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Code sent via {otpChannel === "sms" ? "SMS" : otpChannel === "email" ? "email" : "—"} to{" "}
                  <span className="font-mono">{otpMaskedPhone}</span>
                </p>
              </div>
            ) : null}

            <div>
              <label className="text-xs font-medium text-white block mb-1.5">6-digit code <span className="text-red-500">*</span></label>
              <input
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                autoFocus={otpRequested}
                placeholder="000000"
                className="w-full rounded-md border border-white/[0.08] bg-white/[0.06] px-3 h-12 text-lg font-mono tracking-widest text-center text-white placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
              <button
                type="button"
                onClick={() => handoverToken && sendDeliveryOtp(handoverToken)}
                disabled={otpRequesting}
                className="mt-1.5 text-[11px] text-orange-400 hover:text-orange-300 underline-offset-2 hover:underline disabled:opacity-60 inline-flex items-center gap-1"
              >
                {otpRequesting ? <><Loader2 className="h-3 w-3 animate-spin" /> Sending…</> : <><Send className="h-3 w-3" /> Resend code</>}
              </button>
            </div>

            {otpError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{otpError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={otpSubmitting || !otpRequested || otpCode.trim().length < 4}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-purple-700 text-white h-11 text-sm font-semibold transition-colors hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {otpSubmitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirming delivery…</>
                : <><ShieldCheck className="h-4 w-4" /> Confirm delivery</>}
            </button>

            <button
              type="button"
              onClick={() => { setPhase("actor-select"); setHandoverToken(null); }}
              className="w-full text-xs text-stone-500 underline underline-offset-2 hover:text-stone-300"
            >
              Cancel and pick a different actor
            </button>
          </form>
        )}

        {/* ── QR code ──────────────────────────────────────────────────── */}
        {phase === "qr" && scanUrl && (
          <div className="flex flex-col items-center gap-5">
            <div>
              <h1 className="text-base font-semibold text-white text-center">Handover QR</h1>
              <p className="text-xs text-stone-400 mt-1 text-center">
                Ask the {selectedActor?.label.toLowerCase() || "receiver"} to scan this code on their phone.
              </p>
            </div>

            <div className="rounded-lg border border-white/[0.06] p-4 bg-white">
              <QRCodeSVG value={scanUrl} size={200} />
            </div>

            {secondsLeft > 0 ? (
              <p className="text-xs font-medium text-amber-400">
                Expires in {mins}:{String(secs).padStart(2, "0")}
              </p>
            ) : (
              <p className="text-xs font-medium text-red-600">Expired — generate a new code</p>
            )}

            <div className="w-full space-y-2">
              <button
                onClick={async () => { await navigator.clipboard.writeText(scanUrl); }}
                disabled={secondsLeft === 0}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-white/[0.06] h-9 text-xs text-stone-400 hover:text-white disabled:opacity-40"
              >
                Copy link to share
              </button>

              {secondsLeft === 0 && (
                <button
                  onClick={() => { setHandoverToken(null); setPhase("actor-select"); }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 text-white h-9 text-xs font-semibold hover:bg-orange-700"
                >
                  Generate new code
                </button>
              )}
            </div>

            <button
              onClick={() => setConfirmed(true)}
              className="text-xs text-stone-400 underline underline-offset-2"
            >
              Receiver confirmed in person
            </button>
          </div>
        )}

        {/* ── Success — run session ────────────────────────────────────── */}
        {(phase === "success" || confirmed) && custody?.mode === "run" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            <div className="h-16 w-16 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Custody transferred</p>
              <p className="text-xs text-stone-400 mt-1">
                Shipment handed over successfully.
              </p>
            </div>
            <button
              onClick={async () => {
                setConfirmed(false);
                setActiveRunShipment(null);
                await refreshRunCustody();
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 text-white px-4 h-9 text-xs font-semibold hover:bg-orange-700"
            >
              Back to remaining <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Success — single session ─────────────────────────────────── */}
        {(phase === "success" || confirmed) && custody?.mode !== "run" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            <div className="h-16 w-16 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Custody transferred</p>
              <p className="text-xs text-stone-400 mt-1">
                You have successfully handed over custody. The chain of custody has been updated.
              </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
