import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2, ShieldCheck, MapPin, ArrowRight, CheckCircle2,
  Package, Phone, Hash, ChevronRight, Layers, Building2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { custodianApi, publicWaybillApi, ACTOR_LABELS, type ActorType, type RunShipmentItem } from "@/services/handover";
import { PublicNav } from "@/components/layout/PublicNav";

type Phase =
  | "loading"
  | "find-session"
  | "resent"
  | "phone"
  | "otp"
  | "custody"
  | "run-custody"
  | "actor-select"
  | "qr"
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

  const [custody, setCustody] = useState<{
    name: string;
    actorType: ActorType;
    shipment?: { goodsDescription: string; pickupLocation: string; deliveryLocation: string };
    waybillId?: string | null;
    waybillNumber?: string | null;
    mode?: "run";
    runId?: string;
    shipments?: RunShipmentItem[];
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

  const scanUrl = handoverToken
    ? `${window.location.origin}/scan?token=${handoverToken}`
    : null;

  useEffect(() => {
    if (!sessionId) setPhase("find-session");
    else setPhase("phone");
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
      setPhase("qr");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not generate handover code. Check your connection and try again.";
      setQrError(msg);
    } finally {
      setSubmitting(false);
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

        {/* ── Find session ─────────────────────────────────────────────── */}
        {phase === "find-session" && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            try {
              await custodianApi.resendLink(phone);
              setPhase("resent");
            } catch (err: unknown) {
              setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "No active session found for this number.");
            } finally {
              setSubmitting(false);
            }
          }} className="space-y-5">
            <div>
              <h1 className="text-base font-semibold text-white">Find your custody link</h1>
              <p className="text-xs text-stone-400 mt-1">
                Enter your phone number to retrieve your active custody session. We'll re-send the link via SMS.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-white block mb-1.5">
                Phone number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  inputMode="tel"
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.06] pl-9 pr-3 h-10 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 text-white h-11 text-sm font-semibold hover:bg-orange-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              Re-send my link
            </button>
          </form>
        )}

        {/* ── Link resent ──────────────────────────────────────────────── */}
        {phase === "resent" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Link sent</p>
              <p className="text-xs text-stone-400 mt-1">
                Check your SMS for the custody link and tap it to continue.
              </p>
            </div>
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
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  inputMode="tel"
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.06] pl-9 pr-3 h-10 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>
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
        {phase === "run-custody" && custody?.mode === "run" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-orange-500 shrink-0" />
                <p className="text-xs font-semibold text-white">
                  {custody.name} — {custody.shipments?.length ?? 0} shipment{(custody.shipments?.length ?? 0) !== 1 ? "s" : ""} in your custody
                </p>
              </div>
              <p className="text-[11px] text-stone-400">
                Tap a shipment to hand it over individually, or transfer all at once.
              </p>
            </div>

            {(custody.shipments?.length ?? 0) > 1 && (
              <button
                onClick={() => {
                  setBulkMode(true);
                  setActiveRunShipment(null);
                  setReceiverActorType("ACTOR_COURIER");
                  setPhase("actor-select");
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 text-white h-10 text-sm font-semibold hover:bg-orange-700 transition-colors"
              >
                <Layers className="h-4 w-4" />
                Transfer all ({custody.shipments?.length})
              </button>
            )}

            <div className="space-y-2">
              {(custody.shipments ?? []).map((item) => (
                <div key={item.shipmentId} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 space-y-1.5">
                  {item.waybillNumber && (
                    <p className="text-[11px] font-mono font-semibold text-white">{item.waybillNumber}</p>
                  )}
                  <p className="text-xs text-white">{item.goodsDescription}</p>
                  {item.pickupLocation && item.deliveryLocation && (
                    <p className="text-[10px] text-stone-400 flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      {item.pickupLocation} → {item.deliveryLocation}
                    </p>
                  )}
                  {item.recipientName && (
                    <p className="text-[10px] text-stone-400">Recipient: {item.recipientName}</p>
                  )}
                  <button
                    onClick={() => handleRunShipmentHandover(item)}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-orange-600 text-white px-3 h-7 text-xs font-semibold hover:bg-orange-700 transition-colors"
                  >
                    <ChevronRight className="h-3 w-3" /> Transfer
                  </button>
                </div>
              ))}
            </div>

            {(custody.shipments?.length ?? 0) === 0 && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
                <p className="text-sm font-semibold text-white">All shipments transferred</p>
                <p className="text-xs text-stone-400">No remaining items in your custody.</p>
              </div>
            )}
          </div>
        )}

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
              {STAFF_ACTOR_OPTIONS.map(({ type, label, description }) => (
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
