import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2, ShieldCheck, MapPin, ArrowRight, CheckCircle2,
  Package, Phone, Hash, ChevronRight, Layers, Truck, Navigation, LogOut,
  AlertCircle, Send, Camera, X as XIcon,
} from "lucide-react";
import { formatNaira } from "@/lib/format";
import { QRCodeSVG } from "qrcode.react";
import { custodianApi, publicHandoverApi, publicBatchApi, publicWaybillApi, ACTOR_LABELS, type ActorType, type RunShipmentItem, type CustodySessionSummary, type TokenInfo, type HandoverConfirmation, type BatchTokenInfo, type BulkHandoverConfirmed } from "@/services/handover";
import { PublicNav } from "@/components/layout/PublicNav";
import { PhoneInput } from "@/components/PhoneInput";
import { savePhoneToken, getPhoneToken, clearPhoneToken } from "@/lib/custodianPhoneToken";

type Phase =
  | "loading"
  | "find-phone"     // no ref param — driver enters phone to get verification code
  | "find-otp"       // driver enters the 6-digit code
  | "session-picker" // verified — pick from list of active custody sessions
  | "phone"          // legacy SMS-link path: enter phone for one known session
  | "otp"            // legacy SMS-link path: enter OTP for that session
  | "custody"        // single-shipment session
  | "run-custody"    // run session — list of remaining shipments
  | "actor-select"
  | "qr"
  | "delivery-otp"   // final-mile delivery — OTP to receiver phone on waybill
  | "success"
  | "error";

const HANDOVER_ACTOR_OPTIONS: ActorType[] = ["ACTOR_COURIER", "ACTOR_HUB", "ACTOR_RECEIVER"];

export default function DriverHandoverPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("ref") || "";
  // ?join=<handoverToken> — a different driver's handover QR pointing here.
  // We surface a banner once the rider is authenticated and confirm via
  // /api/handover/confirm-as-rider (no form, identity from network_riders).
  const joinToken = params.get("join") || "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");

  // Pending receiving-rider join state
  const [joinTokenInfo, setJoinTokenInfo] = useState<TokenInfo | null>(null);
  const [joinBatchInfo, setJoinBatchInfo] = useState<BatchTokenInfo | null>(null);
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState<HandoverConfirmation | BulkHandoverConfirmed | null>(null);

  // GPS — auto-capture once when the page mounts so it's available for
  // any handover the rider does on this page (join, delivery OTP, etc.).
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* user denied or timeout — proceed without coords */ },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, []);

  // OTP flow
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [custodianToken, setCustodianToken] = useState<string | null>(null);

  // Find-my-custody picker — populated after verify-otp-by-phone
  const [discoveredSessions, setDiscoveredSessions] = useState<CustodySessionSummary[]>([]);

  // Custody info
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

  // Run session — which shipment the driver is handing over next
  const [activeRunShipment, setActiveRunShipment] = useState<RunShipmentItem | null>(null);

  // Full waybill chain (cross-operator visibility)
  const [waybillChain, setWaybillChain] = useState<Array<{
    id: string;
    giverActorType: ActorType;
    receiverActorType: ActorType;
    proofHash: string;
    occurredAt: string;
  }>>([]);

  // Handover
  const [receiverActorType, setReceiverActorType] = useState<ActorType>("ACTOR_HUB");
  const [handoverToken, setHandoverToken] = useState<string | null>(null);
  const [, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const secondsLeftRef = useRef(secondsLeft);
  useEffect(() => { secondsLeftRef.current = secondsLeft; }, [secondsLeft]);

  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qrError, setQrError] = useState("");

  // Photo bypass state — giver photographs receiver as evidence
  const [photoBypass, setPhotoBypass] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [bypassReceiverName, setBypassReceiverName] = useState("");
  const [bypassReceiverPhone, setBypassReceiverPhone] = useState("");
  const [bypassSubmitting, setBypassSubmitting] = useState(false);
  const [bypassError, setBypassError] = useState("");
  const [bulkMode, setBulkMode] = useState(false);

  // Final-mile delivery OTP state — used when handing off directly to the
  // household receiver. The driver fires the OTP, the customer reads it
  // off their phone, the driver types it. No QR scan involved.
  const [otpRequesting, setOtpRequesting] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpMaskedPhone, setOtpMaskedPhone] = useState("");
  const [otpChannel, setOtpChannel] = useState<"sms" | "email" | "none">("none");
  const [otpReceiverName, setOtpReceiverName] = useState<string | null>(null);
  const [otpGoodsDescription, setOtpGoodsDescription] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  // Route the QR target based on who's receiving.
  // - ACTOR_HUB (staff at next operator) → /join, scanner is in their dashboard
  // - ACTOR_COURIER (next rider) → /handover/driver?join=… so they can phone-OTP
  //   into their own custody session and the system derives identity from
  //   their pre-verified rider record. No form, no manual ID entry.
  // - ACTOR_RECEIVER never reaches here (we route to delivery-otp first).
  // - Bulk handovers still use the public /scan flow.
  const scanUrl = handoverToken
    ? bulkMode
      ? `${window.location.origin}/scan?token=${handoverToken}`
      : receiverActorType === "ACTOR_HUB"
        ? `${window.location.origin}/join?token=${handoverToken}`
        : receiverActorType === "ACTOR_COURIER"
          ? `${window.location.origin}/handover/driver?join=${handoverToken}`
          : `${window.location.origin}/scan?token=${handoverToken}`
    : null;

  // Independent effect: fetch the join token's preview info as soon as the
  // page mounts. Dispatch runs generate batch tokens — try batch first, fall
  // back to single. The actual confirm happens once authenticated.
  useEffect(() => {
    if (!joinToken) return;
    publicBatchApi.getInfo(joinToken)
      .then((info) => setJoinBatchInfo(info))
      .catch(() => {
        // Not a batch token — try single handover token
        publicHandoverApi.getTokenInfo(joinToken)
          .then((info) => setJoinTokenInfo(info))
          .catch((err) => {
            const msg = err?.response?.data?.message || "This join link is invalid or expired.";
            setJoinError(msg);
          });
      });
  }, [joinToken]);

  async function handleConfirmAsRider() {
    if (!joinToken) return;
    const phoneTok = getPhoneToken();
    if (!phoneTok) {
      setJoinError("Sign in with your phone first to join this leg.");
      return;
    }
    setJoinSubmitting(true);
    setJoinError("");
    try {
      let result: HandoverConfirmation | BulkHandoverConfirmed;
      if (joinBatchInfo) {
        // Dispatch run — batch token. Use the bulk rider-auth endpoint.
        result = await publicHandoverApi.confirmBulkAsRider({
          token: joinToken,
          phoneToken: phoneTok,
          latitude:  gpsCoords?.lat,
          longitude: gpsCoords?.lng,
        });
      } else {
        // Single-shipment handover token
        result = await publicHandoverApi.confirmAsRider({
          token: joinToken,
          phoneToken: phoneTok,
          latitude:  gpsCoords?.lat,
          longitude: gpsCoords?.lng,
        });
      }
      setJoinSuccess(result);
      // Refresh the custody session list so the new shipment(s) appear
      const sessionsResp = await custodianApi.sessionsByPhoneToken(phoneTok).catch(() => null);
      if (sessionsResp?.sessions) setDiscoveredSessions(sessionsResp.sessions);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || "Could not join the leg. Make sure your operator has verified your ID.";
      setJoinError(msg);
    } finally {
      setJoinSubmitting(false);
    }
  }

  useEffect(() => {
    // Legacy SMS-link path (?ref=<sessionId>) — always asks for phone+OTP for
    // the specific session it carries.
    if (sessionId) { setPhase("phone"); return; }

    // Otherwise: if we have a saved phone token, skip straight to the
    // session picker. Expired / revoked tokens are cleared silently and
    // the user lands on the normal phone-entry form.
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

  // Countdown for QR expiry
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  // Poll custodian session while showing QR to detect remote confirmation.
  // When the receiver scans and confirms, either the session ends (single
  // shipment) or the active shipment is removed from the run list.
  useEffect(() => {
    if (phase !== "qr" || !custodianToken) return;

    const interval = setInterval(async () => {
      try {
        const info = await custodianApi.getMe(custodianToken);
        if (info.mode === "run") {
          const remaining = info.shipments ?? [];
          if (bulkMode) {
            const prevCount = custody?.shipments?.length ?? 0;
            if (remaining.length < prevCount) {
              setCustody(info);
              setPhase(remaining.length === 0 ? "success" : "run-custody");
            }
          } else if (activeRunShipment) {
            const stillThere = remaining.some((s) => s.shipmentId === activeRunShipment.shipmentId);
            if (!stillThere) {
              setCustody(info);
              setPhase(remaining.length === 0 ? "success" : "run-custody");
            }
          }
        }
        // Single session: getMe throwing is handled in the catch block below.
      } catch {
        // Session gone = custody was passed for a single-shipment session.
        if (custody?.mode !== "run") {
          setPhase("success");
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, custodianToken]);

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
      // Stash the long-lived token so refreshing the page keeps the rider
      // signed in until it expires (7 days).
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

      // For final-mile delivery (single shipment to household), skip the QR
      // scan altogether. Send the OTP to the receiver phone on the waybill;
      // the driver enters the code the customer reads aloud.
      if (receiverActorType === "ACTOR_RECEIVER" && !bulkMode) {
        setOtpRequested(false);
        setOtpCode("");
        setOtpError("");
        setPhase("delivery-otp");
        // Auto-fire the OTP request — saves the driver a tap.
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
        latitude:  gpsCoords?.lat,
        longitude: gpsCoords?.lng,
      });
      setConfirmed(true);
      if (custody?.mode === "run") {
        // Stay in run flow — refreshRunCustody will advance the list
        setPhase("success");
      } else {
        setPhase("success");
      }
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
    setReceiverActorType("ACTOR_RECEIVER");
    setPhase("actor-select");
  }

  async function refreshRunCustody() {
    if (!custodianToken) return;
    try {
      const info = await custodianApi.getMe(custodianToken);
      setCustody(info);
      if (!info.shipments?.length) {
        setPhase("success");
      } else {
        setPhase("run-custody");
      }
    } catch {
      // silently ignore
    }
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handlePhysicalConfirm() {
    if (!photoPreview || !bypassReceiverName || !handoverToken) return;
    const phoneToken = getPhoneToken();
    if (!phoneToken) {
      setBypassError("Phone token missing — sign out and sign back in.");
      return;
    }
    setBypassSubmitting(true);
    setBypassError("");
    try {
      await publicHandoverApi.physicalConfirm({
        token: handoverToken,
        phoneToken,
        receiverName: bypassReceiverName,
        receiverPhone: bypassReceiverPhone || undefined,
        receiverActorType,
        photoDataUrl: photoPreview,
        latitude:  gpsCoords?.lat,
        longitude: gpsCoords?.lng,
      });
      setPhotoBypass(false);
      setConfirmed(true);
      setPhase("success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || "Could not confirm handover. Try again.";
      setBypassError(msg);
    } finally {
      setBypassSubmitting(false);
    }
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="min-h-screen bg-[#060d18] text-white flex flex-col">
      <PublicNav />
      <main className="flex-1 flex flex-col px-4 pt-24 pb-12 max-w-md mx-auto w-full">

        {/* Pending join-leg banner — visible when /handover/driver?join=<token>
            is the URL. After the rider authenticates, the Accept button
            confirms the handover with their session-bound identity. */}
        {joinToken && !joinSuccess && (
          <div className="mb-5 rounded-xl border border-purple-500/25 bg-purple-500/[0.08] p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <Package className="h-4 w-4 text-purple-300 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-purple-200">
                  {joinBatchInfo
                    ? `${joinBatchInfo.shipments.length} shipment${joinBatchInfo.shipments.length !== 1 ? "s" : ""} waiting for handover`
                    : "A handover is waiting for you"}
                </p>
                {joinBatchInfo ? (
                  <div className="mt-1.5 space-y-1 max-h-24 overflow-y-auto">
                    {joinBatchInfo.shipments.map((s) => (
                      <p key={s.shipmentId} className="text-[11px] text-purple-300/80 truncate">
                        {s.waybillNumber ? <span className="font-mono">{s.waybillNumber}</span> : null}
                        {s.waybillNumber && s.goodsDescription ? " · " : null}
                        {s.goodsDescription}
                      </p>
                    ))}
                  </div>
                ) : joinTokenInfo ? (
                  <>
                    <p className="text-[11px] text-purple-300/80 mt-0.5 truncate">
                      {joinTokenInfo.shipment.goodsDescription}
                    </p>
                    <p className="text-[10px] text-purple-300/60 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      {joinTokenInfo.shipment.pickupLocation} → {joinTokenInfo.shipment.deliveryLocation}
                    </p>
                    {joinTokenInfo.giverName && (
                      <p className="text-[10px] text-purple-300/60 mt-0.5">
                        From: <span className="text-purple-200">{joinTokenInfo.giverName}</span>
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-purple-300/70 mt-0.5">Loading details…</p>
                )}
              </div>
            </div>
            {joinError && (
              <p className="text-[11px] text-red-300 flex items-start gap-1.5">
                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />{joinError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmAsRider}
                disabled={joinSubmitting || (!joinTokenInfo && !joinBatchInfo) || !getPhoneToken()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-purple-700 hover:bg-purple-800 text-white h-10 text-xs font-semibold disabled:opacity-60 transition-colors"
                title={!getPhoneToken() ? "Sign in with your phone first" : undefined}
              >
                {joinSubmitting
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Confirming…</>
                  : <><ShieldCheck className="h-3.5 w-3.5" /> {joinBatchInfo ? `Accept ${joinBatchInfo.shipments.length} shipments` : "Accept custody"}</>}
              </button>
            </div>
            {!getPhoneToken() && (
              <p className="text-[10px] text-purple-300/60 text-center">
                Sign in with your phone below to enable accept.
              </p>
            )}
          </div>
        )}

        {/* Confirmation toast after accept */}
        {joinSuccess && (
          <div className="mb-5 rounded-xl border border-green-500/25 bg-green-500/[0.08] p-4 flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-green-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-green-200">
                {"confirmedCount" in joinSuccess
                  ? `${joinSuccess.confirmedCount} shipment${joinSuccess.confirmedCount !== 1 ? "s" : ""} received`
                  : "Custody received"}
              </p>
              <p className="text-[10px] text-green-300/60 truncate font-mono">
                {"proofHash" in joinSuccess
                  ? `PoH: ${joinSuccess.proofHash?.slice(0, 16)}…`
                  : `${joinSuccess.proofHashes?.length} proof${joinSuccess.proofHashes?.length !== 1 ? "s" : ""} recorded`}
              </p>
            </div>
          </div>
        )}

        {/* Find-my-custody — phase 1: enter phone */}
        {phase === "find-phone" && (
          <form onSubmit={handleRequestOtpByPhone} className="space-y-5">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-9 w-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <Truck className="h-4.5 w-4.5 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-white">Driver handover</h1>
                  <p className="text-[11px] text-stone-500">Find your custody</p>
                </div>
              </div>
              <p className="text-xs text-stone-400 mt-2">
                Enter the phone number on file. We'll send you a one-time code so you can see every custody session assigned to you.
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
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-purple-700 text-white h-11 text-sm font-semibold hover:bg-purple-800 disabled:opacity-60"
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
                <div className="h-9 w-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <Hash className="h-4.5 w-4.5 text-purple-400" />
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
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-purple-700 text-white h-11 text-sm font-semibold hover:bg-purple-800 disabled:opacity-60"
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
                <div className="h-9 w-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <Truck className="h-4.5 w-4.5 text-purple-400" />
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
                  When an operator dispatches a run or hands off a shipment to your phone, it'll show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {discoveredSessions.map((session) => (
                  <button
                    key={session.sessionId}
                    type="button"
                    onClick={() => openDiscoveredSession(session)}
                    className="w-full text-left rounded-lg border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-purple-500/30 p-4 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          {session.mode === "run" ? (
                            <Layers className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-purple-400 shrink-0" />
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
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-purple-500/[0.1] border border-purple-500/20 px-1.5 py-0.5 text-purple-300">
                            {ACTOR_LABELS[session.receiverActorType]}
                          </span>
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-stone-600 group-hover:text-purple-400 transition-colors shrink-0" />
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

        {/* Error */}
        {phase === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-red-500/15 flex items-center justify-center">
              <Package className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-sm font-medium text-white">Something went wrong</p>
            <p className="text-xs text-stone-400 max-w-xs">{error}</p>
          </div>
        )}

        {/* Phone entry */}
        {phase === "phone" && (
          <form onSubmit={handleRequestOtp} className="space-y-5">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-9 w-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <Truck className="h-4.5 w-4.5 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-white">Driver verification</h1>
                  <p className="text-[11px] text-stone-500">Custody handover</p>
                </div>
              </div>
              <p className="text-xs text-stone-400 mt-2">
                Enter the phone number you provided when you received this package. We'll send a one-time code.
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
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-purple-700 text-white h-11 text-sm font-semibold hover:bg-purple-800 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Send OTP
            </button>
          </form>
        )}

        {/* OTP entry */}
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
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-purple-700 text-white h-11 text-sm font-semibold hover:bg-purple-800 disabled:opacity-60"
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

        {/* Custody card */}
        {phase === "custody" && custody && (
          <div className="space-y-5">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-5 space-y-3">
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">You currently hold custody of</p>
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
                <ShieldCheck className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <span className="text-xs text-purple-300 font-medium">
                  {custody.name} — {ACTOR_LABELS[custody.actorType]}
                </span>
              </div>
            </div>

            {/* Full chain — gives driver visibility into where the package came from */}
            {waybillChain.length > 0 && (
              <div className="rounded-lg border border-purple-400/15 bg-white/[0.03] p-4 space-y-3">
                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                  Custody history ({waybillChain.length} event{waybillChain.length !== 1 ? "s" : ""})
                </p>
                <div className="relative">
                  <div className="absolute left-[13px] top-4 bottom-4 w-px bg-purple-500/15" />
                  <div className="space-y-2">
                    {waybillChain.map((event, idx) => (
                      <div key={event.id} className="relative flex gap-3 items-start">
                        <div className={[
                          "relative z-10 shrink-0 h-7 w-7 rounded-full border flex items-center justify-center text-[9px] font-bold",
                          idx === waybillChain.length - 1
                            ? "border-purple-400 bg-[#060d18] text-purple-400"
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
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-purple-700 text-white h-11 text-sm font-semibold hover:bg-purple-800"
            >
              Pass custody <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Run custody — list of remaining shipments */}
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

              {/* ── Run header card — identity + progress + value ─────────── */}
              <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-purple-500/[0.08] to-white/[0.02] p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                    <Truck className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{custody.name}</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {startedAt
                        ? `Picked up ${startedAt.toLocaleString("en-NG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                        : "Run in custody"}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-stone-400 font-medium">
                      {deliveredCount} of {totalCount} delivered
                    </span>
                    <span className="text-purple-300 font-semibold tabular-nums">{pctDelivered}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all"
                      style={{ width: `${pctDelivered}%` }}
                    />
                  </div>
                </div>

                {/* Value summary */}
                {progress && progress.totalValue > 0 && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-stone-500 font-medium">In your custody</p>
                      <p className="text-sm font-semibold text-purple-200 tabular-nums">{formatNaira(progress.remainingValue * 100)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-stone-500 font-medium">Total run value</p>
                      <p className="text-sm font-semibold text-stone-200 tabular-nums">{formatNaira(progress.totalValue * 100)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Bulk handover CTA (visible when 2+ remaining) ─────────── */}
              {remainingCount > 1 && (
                <button
                  onClick={() => {
                    setBulkMode(true);
                    setActiveRunShipment(null);
                    setReceiverActorType("ACTOR_HUB");
                    setPhase("actor-select");
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/[0.16] hover:border-purple-500/40 h-11 text-sm font-semibold text-purple-200 transition-all"
                >
                  <Layers className="h-4 w-4" />
                  Hand over all {remainingCount} at once
                </button>
              )}

              {/* ── Shipment cards ────────────────────────────────────────── */}
              {remainingShipments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-stone-600 uppercase tracking-[0.12em] px-1">
                    Still in your custody
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
                              <p className="text-[10px] font-mono font-semibold text-purple-300 mb-1">{item.waybillNumber}</p>
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

                        {/* Recipient row with tap-to-call + navigate */}
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
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-purple-500 to-purple-700 text-white h-9 text-xs font-semibold hover:from-purple-400 hover:to-purple-600 transition-all"
                        >
                          Hand over <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Empty state — everything delivered ─────────────────────── */}
              {remainingShipments.length === 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] py-10 text-center space-y-2">
                  <div className="flex justify-center">
                    <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-emerald-200">Run complete</p>
                  <p className="text-xs text-emerald-400/70 max-w-xs mx-auto">
                    Every shipment in this run has been handed over.
                  </p>
                </div>
              )}

              {/* ── Footer — switch session / sign out ─────────────────────── */}
              <button
                type="button"
                onClick={() => {
                  setCustody(null);
                  setCustodianToken(null);
                  setError("");
                  if (discoveredSessions.length > 0) {
                    setPhase("session-picker");
                  } else {
                    // Real sign-out — drop the long-lived token too so we
                    // don't auto-resume on the next visit.
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

        {/* Actor selection */}
        {phase === "actor-select" && (
          <div className="space-y-5">
            <div>
              <h1 className="text-base font-semibold text-white">Who are you handing to?</h1>
              <p className="text-xs text-stone-400 mt-1">Select the role of the person receiving the package.</p>
            </div>
            {bulkMode && custody?.shipments && (
              <div className="rounded-lg border border-purple-400/15 bg-purple-500/10 px-3 py-2">
                <p className="text-[11px] text-purple-400 font-medium">
                  Bulk handover — {custody.shipments.length} shipment{custody.shipments.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
            {!bulkMode && activeRunShipment && (
              <div className="rounded-lg border border-purple-400/15 bg-purple-500/10 px-3 py-2">
                <p className="text-[11px] text-purple-400 font-medium truncate">
                  {activeRunShipment.waybillNumber || activeRunShipment.goodsDescription}
                </p>
              </div>
            )}
          <div className="grid grid-cols-1 gap-2">
              {HANDOVER_ACTOR_OPTIONS
                // Final delivery is per-shipment only — hide it in bulk mode.
                .filter((type) => !(bulkMode && type === "ACTOR_RECEIVER"))
                .map((type) => (
                  <button
                    key={type}
                    onClick={() => setReceiverActorType(type)}
                    className={[
                      "rounded-md border px-4 py-3 text-sm font-medium text-left transition-colors",
                      receiverActorType === type
                        ? "border-purple-400 bg-purple-500/10 text-purple-300"
                        : "border-white/[0.06] text-stone-400 hover:border-purple-400/30",
                    ].join(" ")}
                  >
                    {ACTOR_LABELS[type]}
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
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-purple-700 text-white h-11 text-sm font-semibold hover:bg-purple-800 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Generate handover QR
            </button>
          </div>
        )}

        {/* Final-mile delivery OTP — driver enters the code the customer reads aloud */}
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

            {/* Recipient summary — derived from waybill, not editable */}
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

            {/* OTP send status */}
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

        {/* QR code */}
        {phase === "qr" && scanUrl && (
          <div className="flex flex-col items-center gap-5">
            <div>
              <h1 className="text-base font-semibold text-white text-center">Handover QR</h1>
              <p className="text-xs text-stone-400 mt-1 text-center">
                Ask the {ACTOR_LABELS[receiverActorType].toLowerCase()} to scan this code on their phone.
              </p>
            </div>

            <div className="rounded-lg border border-white/[0.06] p-4 bg-white">
              <QRCodeSVG value={scanUrl} size={200} />
            </div>

            {secondsLeft > 0 ? (
              <div className="flex flex-col items-center gap-1.5">
                <p className="text-xs font-medium text-amber-400">
                  Expires in {mins}:{String(secs).padStart(2, "0")}
                </p>
                <p className="text-[10px] text-stone-600 flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  Waiting for scan…
                </p>
              </div>
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
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-purple-700 text-white h-9 text-xs font-semibold hover:bg-purple-800"
                >
                  Generate new code
                </button>
              )}
            </div>

            <button
              onClick={() => { setPhotoBypass(true); setBypassError(""); setPhotoPreview(null); setBypassReceiverName(""); setBypassReceiverPhone(""); }}
              className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors"
            >
              <Camera className="h-3.5 w-3.5" />
              Can't scan? Take photo evidence
            </button>
          </div>
        )}

        {/* Photo evidence bypass modal */}
        {phase === "qr" && photoBypass && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
            <div className="bg-[#0a1220] border border-white/[0.06] rounded-xl p-5 w-full max-w-sm space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-white">Photo evidence</h2>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Photograph the receiver accepting the package. You accept liability as the handing party.
                  </p>
                </div>
                <button onClick={() => setPhotoBypass(false)} className="text-stone-600 hover:text-stone-400 shrink-0">
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-stone-400">Photo *</label>
                <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.04] px-3 py-2.5 transition-colors">
                  <Camera className="h-4 w-4 text-stone-500 shrink-0" />
                  <span className="text-xs text-stone-500">Tap to take photo or choose file</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={handlePhotoSelect}
                  />
                </label>
                {photoPreview && (
                  <img src={photoPreview} alt="Evidence" className="rounded-lg w-full max-h-40 object-cover border border-white/[0.06]" />
                )}
              </div>

              <div className="space-y-2">
                <input
                  placeholder="Receiver name *"
                  value={bypassReceiverName}
                  onChange={(e) => setBypassReceiverName(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-purple-500/40"
                />
                <PhoneInput
                  value={bypassReceiverPhone}
                  onChange={setBypassReceiverPhone}
                  placeholder="Receiver phone (optional)"
                />
              </div>

              {bypassError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">{bypassError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setPhotoBypass(false)}
                  className="flex-1 rounded-lg border border-white/[0.06] h-9 text-xs text-stone-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePhysicalConfirm}
                  disabled={bypassSubmitting || !photoPreview || !bypassReceiverName.trim()}
                  className="flex-1 rounded-lg bg-orange-600 text-white h-9 text-xs font-semibold hover:bg-orange-700 disabled:opacity-50 inline-flex items-center justify-center"
                >
                  {bypassSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm handover"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmed — run session: per-shipment success */}
        {confirmed && custody?.mode === "run" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            <div className="h-16 w-16 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Custody passed</p>
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
              className="inline-flex items-center gap-1.5 rounded-md bg-purple-700 text-white px-4 h-9 text-xs font-semibold hover:bg-purple-800"
            >
              Back to my run <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* All done — run session: last shipment confirmed, nothing left */}
        {!confirmed && phase === "success" && custody?.mode === "run" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            <div className="h-16 w-16 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Run complete</p>
              <p className="text-xs text-stone-400 mt-1">
                All shipments in this run have been handed over.
              </p>
            </div>
          </div>
        )}

        {/* Confirmed — single session */}
        {(phase === "success" || confirmed) && custody?.mode !== "run" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            <div className="h-16 w-16 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Custody passed</p>
              <p className="text-xs text-stone-400 mt-1">
                You have successfully transferred custody to the next party.
              </p>
            </div>
            <p className="text-[11px] text-stone-400">
              The chain of custody record has been updated on the OLI network.
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
