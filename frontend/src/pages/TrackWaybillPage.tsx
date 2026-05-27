import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Package, MapPin, CheckCircle2, Clock, Loader2,
  ExternalLink, ShieldCheck, Phone, Hash, Lock, BadgeCheck, X,
} from "lucide-react";
import { publicWaybillApi, waybillVerifyApi, ACTOR_LABELS, type ActorType } from "@/services/handover";
import { PublicNav } from "@/components/layout/PublicNav";

// ── Types ────────────────────────────────────────────────────────────────────

/** Public chain event — names stripped by the backend */
interface PublicChainEvent {
  id: string;
  shipmentId: string;
  waybillId: string;
  giverActorType: ActorType;
  receiverActorType: ActorType;
  proofHash: string;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
}

/** Authenticated chain event — full names included */
interface AuthChainEvent extends PublicChainEvent {
  giverName: string | null;
  receiverName: string;
}

interface WaybillSummary {
  id: string;
  waybillNumber: string;
  goodsDescription: string;
  pickupLocation: string;
  deliveryLocation: string;
  estimatedWeightKg: number | null;
  createdAt: string;
  isClaimed: boolean;
  isDelivered: boolean;
  // Only present in authenticated chain response
  senderName?: string;
  senderPhone?: string;
  receiverName?: string;
  receiverPhone?: string;
}

interface WaybillChain {
  waybill: WaybillSummary;
  chain: PublicChainEvent[] | AuthChainEvent[];
  totalHandovers: number;
}

type VerifyPhase = "idle" | "phone" | "otp" | "verifying" | "done";

// ── Component ────────────────────────────────────────────────────────────────

export default function TrackWaybillPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData]     = useState<WaybillChain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  // Verification state
  const [verifyPhase, setVerifyPhase] = useState<VerifyPhase>("idle");
  const [verifyPhone, setVerifyPhone] = useState("");
  const [verifyOtp, setVerifyOtp]     = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifyWorking, setVerifyWorking] = useState(false);
  const [verifiedRole, setVerifiedRole]   = useState<"sender" | "receiver" | null>(null);

  useEffect(() => {
    if (!id) return;
    publicWaybillApi
      .getChain(id)
      .then(setData)
      .catch(() => setError("Waybill not found or tracking unavailable."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setVerifyWorking(true);
    setVerifyError("");
    try {
      await waybillVerifyApi.requestOtp(id, verifyPhone);
      // Always advance — anti-enumeration (server returns sent:true even on mismatch)
      setVerifyPhase("otp");
    } catch {
      setVerifyError("Could not send code. Try again.");
    } finally {
      setVerifyWorking(false);
    }
  }

  async function handleConfirmOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setVerifyWorking(true);
    setVerifyError("");
    try {
      const result = await waybillVerifyApi.confirmOtp(id, verifyPhone, verifyOtp);
      // Fetch full chain with names
      const fullData = await waybillVerifyApi.getChain(id, result.token);
      setData(fullData);
      setVerifiedRole(result.role);
      setVerifyPhase("done");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setVerifyError(msg || "Incorrect code. Try again.");
    } finally {
      setVerifyWorking(false);
    }
  }

  function closeModal() {
    setVerifyPhase("idle");
    setVerifyPhone("");
    setVerifyOtp("");
    setVerifyError("");
  }

  const isAuthEvent = (e: PublicChainEvent | AuthChainEvent): e is AuthChainEvent =>
    "receiverName" in e;

  return (
    <div className="min-h-screen bg-stone-50">
      <PublicNav />

      <main className="max-w-xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-20 space-y-3">
            <div className="h-12 w-12 rounded-full bg-red-100 mx-auto flex items-center justify-center">
              <Package className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-sm font-medium text-foreground">Waybill not found</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {data && (
          <div className="space-y-5">
            {/* Waybill header */}
            <div className="rounded-xl border border-border bg-white p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Waybill
                  </p>
                  <p className="text-lg font-bold text-foreground font-mono">
                    {data.waybill.waybillNumber}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {data.waybill.isDelivered ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 border border-green-200 px-2.5 py-0.5 text-[11px] font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Delivered
                    </span>
                  ) : data.waybill.isClaimed ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-[11px] font-medium">
                      <ShieldCheck className="h-3 w-3" /> In transit
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 text-stone-600 border border-stone-200 px-2.5 py-0.5 text-[11px] font-medium">
                      <Clock className="h-3 w-3" /> Awaiting pickup
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{data.waybill.goodsDescription}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{data.waybill.pickupLocation}</span>
                  <span className="text-stone-300">→</span>
                  <span>{data.waybill.deliveryLocation}</span>
                </div>
                {data.waybill.estimatedWeightKg && (
                  <p className="text-xs text-muted-foreground">{data.waybill.estimatedWeightKg} kg</p>
                )}
              </div>

              {/* Verified party details */}
              {verifiedRole && data.waybill.senderName && (
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <BadgeCheck className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-[11px] font-semibold text-green-700 uppercase tracking-wide">
                      Verified as {verifiedRole}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Sender</p>
                      <p className="text-xs font-medium text-foreground">{data.waybill.senderName}</p>
                      {data.waybill.senderPhone && (
                        <p className="text-[11px] text-muted-foreground">{data.waybill.senderPhone}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Receiver</p>
                      <p className="text-xs font-medium text-foreground">{data.waybill.receiverName}</p>
                      {data.waybill.receiverPhone && (
                        <p className="text-[11px] text-muted-foreground">{data.waybill.receiverPhone}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <p className="text-[11px] text-muted-foreground">
                  Generated{" "}
                  {new Date(data.waybill.createdAt).toLocaleDateString("en-NG", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </p>
                <a
                  href={publicWaybillApi.pdfUrl(data.waybill.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Download PDF
                </a>
              </div>
            </div>

            {/* Identity verification CTA — only show if not yet verified */}
            {verifyPhase === "idle" && (
              <button
                onClick={() => setVerifyPhase("phone")}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 bg-white py-3 text-xs font-medium text-muted-foreground hover:border-stone-400 hover:text-foreground transition-colors"
              >
                <Lock className="h-3.5 w-3.5" />
                Are you the sender or receiver? Verify your identity to see full details
              </button>
            )}

            {/* Verified banner */}
            {verifyPhase === "done" && verifiedRole && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                <BadgeCheck className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-xs font-medium text-green-800">
                  Showing full details — verified as {verifiedRole}
                </p>
              </div>
            )}

            {/* Custody chain */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Custody chain</h2>
                <span className="text-[11px] text-muted-foreground">
                  {data.totalHandovers} handover{data.totalHandovers !== 1 ? "s" : ""}
                </span>
              </div>

              {data.chain.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-white p-6 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">No custody events recorded yet.</p>
                  <p className="text-[11px] text-muted-foreground">
                    Events appear here as the shipment changes hands.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[17px] top-5 bottom-5 w-px bg-border" />
                  <div className="space-y-3">
                    {data.chain.map((event, idx) => {
                      const auth = isAuthEvent(event);
                      return (
                        <div key={event.id} className="relative flex gap-3">
                          <div className={[
                            "relative z-10 shrink-0 h-9 w-9 rounded-full border-2 flex items-center justify-center text-[10px] font-bold",
                            idx === data.chain.length - 1 && data.waybill.isDelivered
                              ? "border-green-500 bg-green-50 text-green-700"
                              : "border-primary bg-primary/10 text-primary",
                          ].join(" ")}>
                            {idx + 1}
                          </div>

                          <div className="flex-1 rounded-lg border border-border bg-white p-3 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="min-w-0">
                                {auth ? (
                                  <>
                                    <p className="text-xs font-semibold text-foreground truncate">
                                      {event.receiverName}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {event.giverName
                                        ? `${event.giverName} (${ACTOR_LABELS[event.giverActorType]})`
                                        : ACTOR_LABELS[event.giverActorType]
                                      }{" "}→ {ACTOR_LABELS[event.receiverActorType]}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-xs font-semibold text-foreground truncate">
                                    {ACTOR_LABELS[event.giverActorType]} → {ACTOR_LABELS[event.receiverActorType]}
                                  </p>
                                )}
                              </div>
                              {event.latitude != null && event.longitude != null && (
                                <a
                                  href={`https://maps.google.com?q=${event.latitude},${event.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5"
                                >
                                  <MapPin className="h-2.5 w-2.5" /> GPS
                                </a>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-mono text-[10px] text-muted-foreground truncate">
                                {event.proofHash.slice(0, 16)}…
                              </p>
                              <p className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                                {new Date(event.occurredAt).toLocaleDateString("en-NG", {
                                  day: "2-digit", month: "short",
                                })}{" "}·{" "}
                                {new Date(event.occurredAt).toLocaleTimeString("en-NG", {
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <p className="text-center text-[11px] text-muted-foreground">
              Powered by Open Logistics Interconnect (OLI) · trackam.ng
            </p>
          </div>
        )}
      </main>

      {/* ── Verification modal ─────────────────────────────────────────────── */}
      {(verifyPhase === "phone" || verifyPhase === "otp" || verifyPhase === "verifying") && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-white shadow-xl overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">Verify your identity</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Enter the phone number used on this waybill
                </p>
              </div>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground mt-0.5 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              {/* Step 1 — phone entry */}
              {verifyPhase === "phone" && (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    We'll send a one-time code to confirm you're the sender or receiver.
                  </p>
                  <div>
                    <label className="text-[11px] font-medium text-foreground block mb-1.5">
                      Phone number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        required
                        autoFocus
                        value={verifyPhone}
                        onChange={(e) => setVerifyPhone(e.target.value)}
                        placeholder="+234 800 000 0000"
                        inputMode="tel"
                        className="w-full rounded-md border border-input bg-white pl-9 pr-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  {verifyError && <p className="text-xs text-red-600">{verifyError}</p>}
                  <button
                    type="submit"
                    disabled={verifyWorking || !verifyPhone.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-stone-900 text-white h-10 text-sm font-semibold hover:bg-stone-800 disabled:opacity-60 transition-colors"
                  >
                    {verifyWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                    Send code
                  </button>
                </form>
              )}

              {/* Step 2 — OTP entry */}
              {verifyPhase === "otp" && (
                <form onSubmit={handleConfirmOtp} className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    A 6-digit code was sent to {verifyPhone}. It's valid for 10 minutes.
                  </p>
                  <div>
                    <label className="text-[11px] font-medium text-foreground block mb-1.5">
                      6-digit code <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        required
                        autoFocus
                        value={verifyOtp}
                        onChange={(e) => setVerifyOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        inputMode="numeric"
                        className="w-full rounded-md border border-input bg-white pl-9 pr-3 h-10 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  {verifyError && <p className="text-xs text-red-600">{verifyError}</p>}
                  <button
                    type="submit"
                    disabled={verifyWorking || verifyOtp.length !== 6}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-stone-900 text-white h-10 text-sm font-semibold hover:bg-stone-800 disabled:opacity-60 transition-colors"
                  >
                    {verifyWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => { setVerifyPhase("phone"); setVerifyOtp(""); setVerifyError(""); }}
                    className="w-full text-xs text-muted-foreground underline underline-offset-2"
                  >
                    Use a different phone number
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
