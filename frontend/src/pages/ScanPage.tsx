import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MapPin, Package, Loader2, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react"; // Package used in error state
import { publicHandoverApi, ACTOR_LABELS, type ActorType, type TokenInfo, type HandoverConfirmation } from "@/services/handover";
import { PublicNav } from "@/components/layout/PublicNav";

type Phase = "loading" | "token-form" | "waybill-view" | "submitting" | "success" | "error";


export default function ScanPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const waybillId = params.get("waybill");

  const [phase, setPhase] = useState<Phase>("loading");
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [waybill] = useState<Record<string, unknown> | null>(null);
  const [confirmation, setConfirmation] = useState<HandoverConfirmation | null>(null);
  const [error, setError] = useState("");

  // Form state
  const [receiverName, setReceiverName] = useState("");
  const [receiverBvn, setReceiverBvn] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverActorType, setReceiverActorType] = useState<ActorType>("ACTOR_COURIER");
  const [gpsStatus, setGpsStatus] = useState<"idle" | "fetching" | "ok" | "denied">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (token) {
      publicHandoverApi.getTokenInfo(token)
        .then((info) => {
          setTokenInfo(info);
          // Pre-fill receiver role to match what the operator specified — locked for integrity
          setReceiverActorType(info.giverActorType);
          setPhase("token-form");
        })
        .catch((err) => { setError(err?.response?.data?.message || "Invalid or expired handover link."); setPhase("error"); });
    } else if (waybillId) {
      // Redirect waybill scans to the dedicated tracking page
      navigate(`/track/${waybillId}`, { replace: true });
    } else {
      setError("No valid token or waybill ID in this link.");
      setPhase("error");
    }
  }, [token, waybillId]);

  function requestGps() {
    setGpsStatus("fetching");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsStatus("ok"); },
      () => setGpsStatus("denied"),
      { timeout: 8000 }
    );
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setPhase("submitting");
    try {
      const result = await publicHandoverApi.confirm({
        token,
        receiverName,
        receiverBvn,
        receiverPhone: receiverPhone || undefined,
        receiverActorType,
        latitude: coords?.lat,
        longitude: coords?.lng,
      });
      setConfirmation(result);
      setPhase("success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Handover failed. Please try again.";
      setError(msg);
      setPhase("error");
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <PublicNav />

      <main className="flex-1 flex flex-col px-4 py-6 max-w-md mx-auto w-full">

        {/* Loading */}
        {phase === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <Package className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-sm font-medium text-foreground">Something went wrong</p>
            <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
          </div>
        )}

        {/* Waybill tracking view */}
        {phase === "waybill-view" && waybill && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-white p-5 space-y-3">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Waybill</p>
              <p className="text-base font-semibold text-foreground">{waybill.waybillNumber as string}</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex gap-2 items-start">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="text-xs font-medium">{waybill.pickupLocation as string}</p>
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">To</p>
                    <p className="text-xs font-medium">{waybill.deliveryLocation as string}</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">Cargo</p>
                <p className="text-sm font-medium">{waybill.goodsDescription as string}</p>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">Receiver</p>
                <p className="text-sm font-medium">{waybill.receiverName as string}</p>
                <p className="text-xs text-muted-foreground">{waybill.receiverAddress as string}</p>
              </div>
            </div>
            <p className="text-[11px] text-center text-muted-foreground">
              Generated via Open Logistics Interconnect (OLI)
            </p>
          </div>
        )}

        {/* Handover confirmation form */}
        {phase === "token-form" && tokenInfo && (
          <form onSubmit={handleConfirm} className="space-y-5">
            {/* Shipment summary card */}
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <p className="text-xs font-semibold text-purple-800 mb-2">You are receiving custody of</p>
              <p className="text-sm font-semibold text-purple-900">{tokenInfo.shipment.goodsDescription}</p>
              <p className="text-xs text-purple-700 mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {tokenInfo.shipment.pickupLocation} → {tokenInfo.shipment.deliveryLocation}
              </p>
            </div>

            {/* Your role — locked to what the operator specified */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Your role</label>
              <div className="flex items-center gap-2 rounded-md border border-purple-200 bg-purple-50 px-3 py-2.5">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <span className="text-xs font-semibold text-purple-800">{ACTOR_LABELS[receiverActorType]}</span>
                <span className="ml-auto text-[10px] text-purple-500">Set by operator</span>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Full name <span className="text-red-500">*</span></label>
              <input
                required
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="e.g. Chukwuemeka Obi"
                className="w-full rounded-md border border-input bg-white px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* BVN */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">BVN <span className="text-red-500">*</span></label>
              <input
                required
                value={receiverBvn}
                onChange={(e) => setReceiverBvn(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="11-digit BVN"
                inputMode="numeric"
                className="w-full rounded-md border border-input bg-white px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Used for identity verification. Not shared publicly.</p>
            </div>

            {/* Phone (optional) */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Phone number <span className="text-muted-foreground">(optional)</span></label>
              <input
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
                placeholder="+234 800 000 0000"
                inputMode="tel"
                className="w-full rounded-md border border-input bg-white px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* GPS */}
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Location <span className="text-muted-foreground">(recommended)</span></p>
              {gpsStatus === "idle" && (
                <button type="button" onClick={requestGps} className="inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-2">
                  <MapPin className="h-3 w-3" /> Capture GPS location
                </button>
              )}
              {gpsStatus === "fetching" && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Fetching location…</p>}
              {gpsStatus === "ok" && coords && <p className="text-xs text-green-700 flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>}
              {gpsStatus === "denied" && <p className="text-xs text-amber-700">Location access denied — handover will continue without GPS.</p>}
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-purple-700 text-white h-11 text-sm font-semibold transition-colors hover:bg-purple-800"
            >
              <ShieldCheck className="h-4 w-4" /> Confirm handover
            </button>
          </form>
        )}

        {/* Submitting */}
        {phase === "submitting" && (
          <div className="flex-1 flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
            <p className="text-sm text-muted-foreground">Generating proof of handover…</p>
          </div>
        )}

        {/* Success */}
        {phase === "success" && confirmation && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Handover confirmed</p>
              <p className="text-xs text-muted-foreground mt-1">
                Custody transferred to {confirmation.receiverName}
              </p>
            </div>
            <div className="w-full rounded-lg border border-border bg-white p-4 text-left space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Proof of Handover (PoH)</p>
              <p className="font-mono text-xs break-all text-foreground">{confirmation.proofHash}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(confirmation.occurredAt).toLocaleString("en-NG")}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Save this hash as your custody receipt. The shipper's dashboard has been updated.
            </p>
            <a href="/waybill" className="inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-2">
              Generate a new waybill <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
