import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MapPin, Package, Loader2, CheckCircle2, ShieldCheck, ArrowRight, Layers, AlertCircle, Phone as PhoneIcon, Send, Camera } from "lucide-react";
import {
  publicHandoverApi, publicBatchApi,
  ACTOR_LABELS, type ActorType, type TokenInfo, type HandoverConfirmation,
  type BatchTokenInfo, type BulkHandoverConfirmed,
} from "@/services/handover";
import { PublicNav } from "@/components/layout/PublicNav";
import { PhoneInput } from "@/components/PhoneInput";
import QRScanner from "@/components/QRScanner";

type Phase = "scanner" | "loading" | "token-form" | "batch-form" | "submitting" | "success" | "error";

/** Extract a handover token from whatever the scanner returned */
function extractScanToken(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const t = url.searchParams.get("token");
    if (t) return t;
  } catch { /* not a URL */ }
  if (/^[a-f0-9]{32,}$/i.test(trimmed)) return trimmed;
  return null;
}

export default function ScanPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const waybillId = params.get("waybill");

  // If no token in the URL, show the scanner so riders/staff can scan on-device
  const [phase, setPhase] = useState<Phase>((!token && !waybillId) ? "scanner" : "loading");
  const [scannedToken, setScannedToken] = useState<string | null>(token);
  const [scanError, setScanError] = useState("");
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [batchInfo, setBatchInfo] = useState<BatchTokenInfo | null>(null);
  const [confirmation, setConfirmation] = useState<HandoverConfirmation | BulkHandoverConfirmed | null>(null);
  const [error, setError] = useState("");          // fatal — invalid/expired link
  const [confirmError, setConfirmError] = useState(""); // inline — fixable validation errors

  // Shared form state — no government ID is ever collected here. The
  // receiver's identity is bound by their operator's pre-verified rider
  // record (cross-operator handover) or, for final delivery, by an OTP
  // sent to the waybill's receiver phone.
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverActorType, setReceiverActorType] = useState<ActorType>("ACTOR_COURIER");
  const [gpsStatus, setGpsStatus] = useState<"idle" | "fetching" | "ok" | "denied">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Final-mile delivery OTP — only used when the token's receiverActorType
  // is ACTOR_RECEIVER. We send the code to the phone recorded on the
  // waybill; the receiver enters it here.
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpMaskedPhone, setOtpMaskedPhone] = useState("");
  const [otpChannel, setOtpChannel] = useState<"sms" | "email" | "none">("none");
  const [otpError, setOtpError] = useState("");

  const isFinalDelivery = receiverActorType === "ACTOR_RECEIVER";

  function handleScannerResult(raw: string) {
    const extracted = extractScanToken(raw);
    if (!extracted) {
      setScanError("That doesn't look like a handover QR code. Try again.");
      return;
    }
    setScannedToken(extracted);
    setScanError("");
    setPhase("loading");
  }

  useEffect(() => {
    if (phase === "scanner") return;
    const activeToken = scannedToken;
    if (!activeToken && !waybillId) {
      setError("No valid token or waybill ID in this link.");
      setPhase("error");
      return;
    }
    if (!activeToken && waybillId) {
      navigate(`/track/${waybillId}`, { replace: true });
      return;
    }
    if (!activeToken) return;

    // Try batch token first, fall back to single token
    publicBatchApi.getInfo(activeToken)
      .then((info) => {
        setBatchInfo(info);
        setReceiverActorType(info.receiverActorType as ActorType);
        setPhase("batch-form");
      })
      .catch(() => {
        // Not a batch token — try single handover token
        publicHandoverApi.getTokenInfo(activeToken)
          .then((info) => {
            setTokenInfo(info);
            setReceiverActorType(info.receiverActorType || info.giverActorType);
            setPhase("token-form");
          })
          .catch((err) => {
            setError(err?.response?.data?.message || "Invalid or expired handover link.");
            setPhase("error");
          });
      });
  }, [scannedToken, waybillId, phase]);

  // Manual re-trigger — used when the user previously denied or the first
  // attempt timed out and they tap "Capture GPS location" to try again.
  function requestGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("denied");
      return;
    }
    setGpsStatus("fetching");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsStatus("ok"); },
      () => setGpsStatus("denied"),
      { timeout: 8000, enableHighAccuracy: false }
    );
  }

  // Auto-capture GPS as soon as the form mounts. Browser shows its
  // permission prompt if the origin doesn't already have a decision;
  // if denied or unsupported, we just continue without coords.
  useEffect(() => {
    if (phase !== "token-form" && phase !== "batch-form") return;
    if (gpsStatus !== "idle") return;
    requestGps();
    // requestGps is stable enough — referencing it would loop the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, gpsStatus]);

  async function handleSendOtp() {
    if (!scannedToken) return;
    setOtpSending(true);
    setOtpError("");
    try {
      const result = await publicHandoverApi.requestDeliveryOtp(scannedToken!);
      if (!result.sent) {
        setOtpError("Could not send the code. Check the phone number on the waybill is correct.");
        return;
      }
      setOtpMaskedPhone(result.maskedPhone);
      setOtpChannel(result.channel);
      setOtpRequested(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Could not send the code. Try again.";
      setOtpError(msg);
    } finally {
      setOtpSending(false);
    }
  }

  async function handleConfirmSingle(e: React.FormEvent) {
    e.preventDefault();
    if (!scannedToken) return;
    if (isFinalDelivery && otp.trim().length < 4) {
      setConfirmError("Enter the 6-digit code we sent to the receiver's phone.");
      return;
    }
    setConfirmError("");
    setPhase("submitting");
    try {
      const result = await publicHandoverApi.confirm({
        token: scannedToken,
        receiverName,
        receiverPhone: receiverPhone || undefined,
        receiverActorType,
        latitude: coords?.lat,
        longitude: coords?.lng,
        otp: isFinalDelivery ? otp.trim() : undefined,
      });
      setConfirmation(result);
      setPhase("success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Handover failed. Please try again.";
      setConfirmError(msg);
      setPhase("token-form");
    }
  }

  async function handleConfirmBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!scannedToken) return;
    setConfirmError("");
    setPhase("submitting");
    try {
      const result = await publicBatchApi.confirm({
        token: scannedToken,
        receiverName,
        receiverPhone: receiverPhone || undefined,
        receiverActorType,
        latitude: coords?.lat,
        longitude: coords?.lng,
      });
      setConfirmation(result);
      setPhase("success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Handover failed. Please try again.";
      setConfirmError(msg);
      setPhase("batch-form");
    }
  }

  return (
    <div className="min-h-screen bg-[#060d18] text-white flex flex-col">
      <PublicNav />

      <main className="flex-1 flex flex-col px-4 pt-24 pb-12 max-w-md mx-auto w-full">

        {/* Scanner phase — shown when no token in URL (rider/staff on-device scan) */}
        {phase === "scanner" && (
          <div className="flex-1 flex flex-col gap-5 py-4">
            <div className="text-center space-y-1">
              <div className="h-12 w-12 rounded-xl bg-purple-500/15 flex items-center justify-center mx-auto">
                <Camera className="h-6 w-6 text-purple-400" />
              </div>
              <p className="text-base font-semibold text-white">Scan handover QR</p>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                Point your camera at the QR code on the dispatcher's screen to begin the handover.
              </p>
            </div>
            <QRScanner
              onScan={handleScannerResult}
              onError={(msg) => { setScanError(msg); }}
            />
            {scanError && (
              <p className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{scanError}
              </p>
            )}
          </div>
        )}

        {phase === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
          </div>
        )}

        {phase === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-red-500/15 flex items-center justify-center">
              <Package className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-sm font-medium text-white">Something went wrong</p>
            <p className="text-xs text-stone-400 max-w-xs">{error}</p>
          </div>
        )}

        {/* Wrong-actor redirect — this token isn't for a household receiver.
            ACTOR_HUB receivers should use /join (in-dashboard) and ACTOR_COURIER
            riders should use /handover/driver?join=… (phone-OTP authenticated).
            The driver should never share a /scan URL for these — but if they
            do, route the visitor to the right place. */}
        {phase === "token-form" && tokenInfo && !isFinalDelivery && (
          <div className="flex flex-1 flex-col items-center justify-center text-center gap-4 py-8">
            <div className="h-14 w-14 rounded-full bg-purple-500/15 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-purple-400" />
            </div>
            <div className="max-w-xs">
              <p className="text-base font-semibold text-white">This link is for an authenticated operator</p>
              <p className="text-sm text-stone-400 mt-1">
                Open it from your Trackam dashboard — identity is bound to your account.
              </p>
            </div>
            <div className="w-full max-w-xs space-y-2">
              {receiverActorType === "ACTOR_HUB" && (
                <a
                  href={`/join?token=${token}`}
                  className="block w-full text-center rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 h-10 leading-10 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition-all"
                >
                  Continue to Join Leg
                </a>
              )}
              {receiverActorType === "ACTOR_COURIER" && (
                <a
                  href={`/handover/driver?join=${token}`}
                  className="block w-full text-center rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 h-10 leading-10 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition-all"
                >
                  Sign in as driver
                </a>
              )}
            </div>
          </div>
        )}

        {/* Single handover form — only for final delivery (household receiver) */}
        {phase === "token-form" && tokenInfo && isFinalDelivery && (
          <form onSubmit={handleConfirmSingle} className="space-y-5">
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-4">
              <p className="text-xs font-semibold text-purple-300 mb-2">You are receiving custody of</p>
              <p className="text-sm font-semibold text-purple-200">{tokenInfo.shipment.goodsDescription}</p>
              <p className="text-xs text-purple-400 mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {tokenInfo.shipment.pickupLocation} → {tokenInfo.shipment.deliveryLocation}
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-white block mb-1.5">Your role</label>
              <div className="flex items-center gap-2 rounded-md border border-purple-500/20 bg-purple-500/10 px-3 py-2.5">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <span className="text-xs font-semibold text-purple-300">{ACTOR_LABELS[receiverActorType]}</span>
                <span className="ml-auto text-[10px] text-purple-400/70">Set by operator</span>
              </div>
            </div>

            {isFinalDelivery ? (
              <DeliveryOtpFields
                receiverName={receiverName} setReceiverName={setReceiverName}
                otp={otp} setOtp={setOtp}
                otpRequested={otpRequested}
                otpSending={otpSending}
                otpMaskedPhone={otpMaskedPhone}
                otpChannel={otpChannel}
                otpError={otpError}
                onSendOtp={handleSendOtp}
                gpsStatus={gpsStatus} coords={coords} requestGps={requestGps}
              />
            ) : (
              <ReceiverFields
                receiverName={receiverName} setReceiverName={setReceiverName}
                receiverPhone={receiverPhone} setReceiverPhone={setReceiverPhone}
                gpsStatus={gpsStatus} coords={coords} requestGps={requestGps}
              />
            )}

            {confirmError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{confirmError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isFinalDelivery && (!otpRequested || otp.trim().length < 4)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-purple-700 text-white h-11 text-sm font-semibold transition-colors hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShieldCheck className="h-4 w-4" />
              {isFinalDelivery ? "Confirm delivery" : "Confirm handover"}
            </button>
          </form>
        )}

        {/* Batch token — non-final actors must use their authenticated flow.
            ACTOR_COURIER → DriverHandoverPage (phone-OTP identity)
            ACTOR_HUB     → JoinLegModal in dashboard (operator profile identity)
            Only ACTOR_RECEIVER stays here for OTP-based delivery confirmation. */}
        {phase === "batch-form" && batchInfo && receiverActorType !== "ACTOR_RECEIVER" && (
          <div className="flex flex-1 flex-col items-center justify-center text-center gap-4 py-8">
            <div className="h-14 w-14 rounded-full bg-purple-500/15 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-purple-400" />
            </div>
            <div className="max-w-xs">
              <p className="text-base font-semibold text-white">Sign in to confirm receipt</p>
              <p className="text-sm text-stone-400 mt-1">
                {batchInfo.shipments.length} shipment{batchInfo.shipments.length !== 1 ? "s" : ""} — your identity is bound to your account, not this form.
              </p>
            </div>
            <div className="w-full max-w-xs space-y-2">
              {receiverActorType === "ACTOR_COURIER" && (
                <a
                  href={`/handover/driver?join=${scannedToken}`}
                  className="block w-full text-center rounded-lg bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 h-10 leading-10 text-sm font-semibold text-white shadow-sm shadow-purple-500/20 transition-all"
                >
                  Sign in as driver
                </a>
              )}
              {receiverActorType === "ACTOR_HUB" && (
                <a
                  href={`/join?token=${scannedToken}`}
                  className="block w-full text-center rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 h-10 leading-10 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition-all"
                >
                  Continue to Join Leg
                </a>
              )}
            </div>
          </div>
        )}

        {/* Batch handover form — only for final-mile delivery to household receiver */}
        {phase === "batch-form" && batchInfo && receiverActorType === "ACTOR_RECEIVER" && (
          <form onSubmit={handleConfirmBatch} className="space-y-5">
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-purple-400 shrink-0" />
                <p className="text-xs font-semibold text-purple-300">
                  You are receiving custody of {batchInfo.shipments.length} shipment{batchInfo.shipments.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {batchInfo.shipments.map((s) => (
                  <div key={s.shipmentId} className="rounded-md bg-white/[0.05] border border-purple-500/15 px-2.5 py-1.5">
                    {s.waybillNumber && (
                      <p className="text-[11px] font-mono font-semibold text-purple-200">{s.waybillNumber}</p>
                    )}
                    <p className="text-[11px] text-purple-400 truncate">{s.goodsDescription}</p>
                    {s.pickupLocation && s.deliveryLocation && (
                      <p className="text-[10px] text-purple-400/70 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        {s.pickupLocation} → {s.deliveryLocation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-white block mb-1.5">Your role</label>
              <div className="flex items-center gap-2 rounded-md border border-purple-500/20 bg-purple-500/10 px-3 py-2.5">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <span className="text-xs font-semibold text-purple-300">{ACTOR_LABELS[receiverActorType]}</span>
                <span className="ml-auto text-[10px] text-purple-400/70">Set by operator</span>
              </div>
            </div>

            <ReceiverFields
              receiverName={receiverName} setReceiverName={setReceiverName}
              receiverPhone={receiverPhone} setReceiverPhone={setReceiverPhone}
              gpsStatus={gpsStatus} coords={coords} requestGps={requestGps}
            />

            {confirmError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{confirmError}</p>
              </div>
            )}

            <button type="submit" className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-purple-700 text-white h-11 text-sm font-semibold transition-colors hover:bg-purple-800">
              <ShieldCheck className="h-4 w-4" /> Confirm receipt of all {batchInfo.shipments.length} shipments
            </button>
          </form>
        )}

        {phase === "submitting" && (
          <div className="flex-1 flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
            <p className="text-sm text-stone-400">Generating proof of handover…</p>
          </div>
        )}

        {phase === "success" && confirmation && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            <div className="h-16 w-16 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Handover confirmed</p>
              {"confirmedCount" in confirmation ? (
                <p className="text-xs text-stone-400 mt-1">
                  {confirmation.confirmedCount} shipment{confirmation.confirmedCount !== 1 ? "s" : ""} transferred to {receiverName}
                </p>
              ) : (
                <p className="text-xs text-stone-400 mt-1">
                  Custody transferred to {(confirmation as HandoverConfirmation).receiverName}
                </p>
              )}
            </div>
            {"confirmedCount" in confirmation ? (
              <div className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 text-left space-y-1.5">
                <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wide">
                  {confirmation.confirmedCount} Proof{confirmation.confirmedCount !== 1 ? "s" : ""} of Handover
                </p>
                {confirmation.proofHashes.slice(0, 3).map((ph) => (
                  <p key={ph.shipmentId} className="font-mono text-[10px] break-all text-white">
                    {ph.proofHash.slice(0, 20)}…
                  </p>
                ))}
                {confirmation.proofHashes.length > 3 && (
                  <p className="text-[10px] text-stone-400">+{confirmation.proofHashes.length - 3} more</p>
                )}
                <p className="text-[11px] text-stone-400 pt-1">Fee deducted: ₦{confirmation.totalFee.toFixed(2)}</p>
              </div>
            ) : (
              <div className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 text-left space-y-2">
                <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wide">Proof of Handover (PoH)</p>
                <p className="font-mono text-xs break-all text-white">{(confirmation as HandoverConfirmation).proofHash}</p>
                <p className="text-[11px] text-stone-400">
                  {new Date((confirmation as HandoverConfirmation).occurredAt).toLocaleString("en-NG")}
                </p>
              </div>
            )}
            <p className="text-[11px] text-stone-400">
              Save these hashes as your custody receipt.
            </p>
            <a
              href="/handover"
              className="w-full max-w-xs inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 h-11 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 transition-all"
            >
              <ShieldCheck className="h-4 w-4" /> Go to Handover
            </a>
            <a href="/waybill" className="inline-flex items-center gap-1.5 text-xs text-orange-400 underline underline-offset-2">
              Generate a new waybill <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

function DeliveryOtpFields({
  receiverName, setReceiverName,
  otp, setOtp,
  otpRequested, otpSending,
  otpMaskedPhone, otpChannel, otpError,
  onSendOtp,
  gpsStatus, coords, requestGps,
}: {
  receiverName: string; setReceiverName: (v: string) => void;
  otp: string; setOtp: (v: string) => void;
  otpRequested: boolean; otpSending: boolean;
  otpMaskedPhone: string; otpChannel: "sms" | "email" | "none"; otpError: string;
  onSendOtp: () => void;
  gpsStatus: "idle" | "fetching" | "ok" | "denied";
  coords: { lat: number; lng: number } | null;
  requestGps: () => void;
}) {
  return (
    <>
      <div>
        <label className="text-xs font-medium text-white block mb-1.5">Your name <span className="text-red-500">*</span></label>
        <input
          required
          value={receiverName}
          onChange={(e) => setReceiverName(e.target.value)}
          placeholder="e.g. Chukwuemeka Obi"
          className="w-full rounded-md border border-white/[0.08] bg-white/[0.06] px-3 h-10 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        />
      </div>

      {/* Step 1: send OTP to receiver phone (from waybill) */}
      {!otpRequested ? (
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/[0.06] p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <PhoneIcon className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-300">Phone-based delivery proof</p>
              <p className="text-[11px] text-orange-200/70 mt-0.5">
                We'll send a 6-digit code to the recipient's phone (as recorded on the waybill).
                Type it in below to confirm delivery.
              </p>
            </div>
          </div>

          {otpError && (
            <p className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-md px-3 py-2">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" /><span>{otpError}</span>
            </p>
          )}

          <button
            type="button"
            onClick={onSendOtp}
            disabled={otpSending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 hover:bg-orange-700 text-white h-10 text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {otpSending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
              : <><Send className="h-4 w-4" /> Send delivery code</>}
          </button>
        </div>
      ) : (
        // Step 2: enter the OTP
        <div className="space-y-3">
          <div className="rounded-lg border border-green-500/20 bg-green-500/[0.06] p-3">
            <p className="text-[11px] text-green-300 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Code sent via {otpChannel === "sms" ? "SMS" : otpChannel === "email" ? "email" : "—"} to <span className="font-mono">{otpMaskedPhone}</span>
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-white block mb-1.5">6-digit code <span className="text-red-500">*</span></label>
            <input
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              autoFocus
              placeholder="000000"
              className="w-full rounded-md border border-white/[0.08] bg-white/[0.06] px-3 h-12 text-lg font-mono tracking-widest text-center text-white placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
            <button
              type="button"
              onClick={onSendOtp}
              disabled={otpSending}
              className="mt-1.5 text-[11px] text-orange-400 hover:text-orange-300 underline-offset-2 hover:underline disabled:opacity-60"
            >
              {otpSending ? "Sending…" : "Resend code"}
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-white mb-1.5">Location <span className="text-stone-400">(recommended)</span></p>
        {gpsStatus === "idle" && (
          <button type="button" onClick={requestGps} className="inline-flex items-center gap-1.5 text-xs text-orange-400 underline underline-offset-2">
            <MapPin className="h-3 w-3" /> Capture GPS location
          </button>
        )}
        {gpsStatus === "fetching" && <p className="text-xs text-stone-400 flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Fetching…</p>}
        {gpsStatus === "ok" && coords && <p className="text-xs text-green-700 flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>}
        {gpsStatus === "denied" && <p className="text-xs text-amber-400">Location access denied — continuing without GPS.</p>}
      </div>
    </>
  );
}

function ReceiverFields({
  receiverName, setReceiverName,
  receiverPhone, setReceiverPhone,
  gpsStatus, coords, requestGps,
}: {
  receiverName: string; setReceiverName: (v: string) => void;
  receiverPhone: string; setReceiverPhone: (v: string) => void;
  gpsStatus: "idle" | "fetching" | "ok" | "denied";
  coords: { lat: number; lng: number } | null;
  requestGps: () => void;
}) {
  return (
    <>
      <div>
        <label className="text-xs font-medium text-white block mb-1.5">Full name <span className="text-red-500">*</span></label>
        <input
          required
          value={receiverName}
          onChange={(e) => setReceiverName(e.target.value)}
          placeholder="e.g. Chukwuemeka Obi"
          className="w-full rounded-md border border-white/[0.08] bg-white/[0.06] px-3 h-10 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        />
        <p className="text-[10px] text-stone-500 mt-1">
          Your identity was verified during onboarding with your logistics company — no ID is collected at handover.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-white block mb-1.5">Phone number <span className="text-stone-400">(recommended)</span></label>
        <PhoneInput
          value={receiverPhone}
          onChange={setReceiverPhone}
          size="md"
        />
        <p className="text-[10px] text-stone-500 mt-1">
          Used so the operator can reach you if there's an issue with the handover.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-white mb-1.5">Location <span className="text-stone-400">(recommended)</span></p>
        {gpsStatus === "idle" && (
          <button type="button" onClick={requestGps} className="inline-flex items-center gap-1.5 text-xs text-orange-400 underline underline-offset-2">
            <MapPin className="h-3 w-3" /> Capture GPS location
          </button>
        )}
        {gpsStatus === "fetching" && <p className="text-xs text-stone-400 flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Fetching…</p>}
        {gpsStatus === "ok" && coords && <p className="text-xs text-green-700 flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>}
        {gpsStatus === "denied" && <p className="text-xs text-amber-400">Location access denied — continuing without GPS.</p>}
      </div>
    </>
  );
}
