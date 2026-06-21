import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, X, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { ridersApi, type Rider } from "@/services/logistics";
import { runsApi } from "@/services/runs";
import { carrierRoutesApi, type CarrierRoute } from "@/services/carrier";

interface Props {
  onCreated?: () => void;
}

type Step = "route" | "confirm";

// Normalised route item — works for both local routes and carrier routes
type RouteOption = {
  id: string;
  name: string;
  pickupLocation: string;
  deliveryLocation: string;
  distanceKm: number | null;
  defaultRiderId: string | null;
  defaultRiderFee: number | null; // Naira (already divided by 100)
  source: "local" | "carrier";
};

function fromCarrierRoute(r: CarrierRoute): RouteOption {
  return {
    id:              r.id,
    name:            r.label || `${r.originCity} → ${r.destCity}`,
    pickupLocation:  r.originCity,
    deliveryLocation: r.destCity,
    distanceKm:      r.distanceKm,
    defaultRiderId:  null,
    defaultRiderFee: r.fixedPriceKobo != null ? r.fixedPriceKobo / 100 : null,
    source:          "carrier",
  };
}

export function QuickDispatch({ onCreated }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("route");

  const [routes, setRoutes]   = useState<RouteOption[]>([]);
  const [riders, setRiders]   = useState<Rider[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [runName, setRunName] = useState("");
  const [riderId, setRiderId] = useState("");
  const [notes, setNotes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [riderFee, setRiderFee] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDataLoading(true);
      Promise.all([
        carrierRoutesApi.list().catch(() => [] as CarrierRoute[]),
        ridersApi.list(),
      ]).then(([carrierRoutes, ri]) => {
        setRoutes(carrierRoutes.map(fromCarrierRoute));
        setRiders(ri);
      }).finally(() => setDataLoading(false));
    }
  }, [open]);

  function openModal() {
    setStep("route");
    setSelectedRoute(null);
    setRunName("");
    setRiderId("");
    setNotes("");
    setDistanceKm("");
    setRiderFee("");
    setExpectedDeliveryDate("");
    setError("");
    setOpen(true);
  }

  function selectRoute(route: RouteOption) {
    setSelectedRoute(route);
    setRunName(route.name);
    setRiderId(route.defaultRiderId || "");
    setDistanceKm(route.distanceKm != null ? String(route.distanceKm) : "");
    setRiderFee(route.defaultRiderFee != null ? String(Math.round(route.defaultRiderFee)) : "");
    setError("");
    setStep("confirm");
  }

  async function handleCreate() {
    if (!riderId) {
      setError("Please select a rider before creating the run.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const run = await runsApi.create({
        name: runName.trim() || undefined,
        riderId,
        notes: notes.trim() || undefined,
        distanceKm: distanceKm ? parseInt(distanceKm, 10) : undefined,
        riderFee: riderFee ? parseInt(riderFee, 10) : undefined,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
      });
      setOpen(false);
      onCreated?.();
      navigate(`/dashboard/runs/${run.id}`);
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create run. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors";

  return (
    <>
      {/* FAB */}
      <button
        onClick={openModal}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-orange-500 to-orange-600 px-4 h-11 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] transition-all"
      >
        <Zap className="h-4 w-4" />
        Quick Dispatch
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-[#0c1522] shadow-2xl shadow-black/40 border border-white/[0.08] overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[75vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
              <div>
                <p className="text-sm font-semibold text-white">
                  {step === "route" ? "Pick a route" : "Set up this run"}
                </p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  {step === "route"
                    ? "Choose the corridor your rider will cover today"
                    : selectedRoute
                      ? `${selectedRoute.pickupLocation} → ${selectedRoute.deliveryLocation}`
                      : ""}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-stone-600 hover:text-stone-300 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── Step 1: Route picker ─────────────────────────────── */}
            {step === "route" && (
              <div className="p-4 overflow-y-auto flex-1">
                {dataLoading ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-white/[0.03] border border-white/[0.06] animate-pulse" />)}
                  </div>
                ) : routes.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <p className="text-sm text-stone-500">No routes defined yet.</p>
                    <a href="/admin/dashboard/settings?tab=carrier" className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
                      Add routes in Settings → Carrier Profile →
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {routes.map((route) => (
                      <button
                        key={route.id}
                        onClick={() => selectRoute(route)}
                        className="w-full flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 text-left hover:border-orange-500/20 hover:bg-white/[0.05] transition-all group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-200 truncate">{route.name}</p>
                          <p className="text-xs text-stone-500 mt-0.5 truncate">
                            {route.pickupLocation} → {route.deliveryLocation}
                            {route.distanceKm != null && ` · ${route.distanceKm} km`}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-stone-600 shrink-0 group-hover:text-orange-400 transition-colors" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Confirm ──────────────────────────────────── */}
            {step === "confirm" && selectedRoute && (
              <>
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1.5">Run name</label>
                    <input
                      value={runName}
                      onChange={(e) => setRunName(e.target.value)}
                      placeholder={`e.g. ${selectedRoute.name} — Morning`}
                      className={inputCls}
                    />
                    <p className="text-[10px] text-stone-600 mt-1">Helps you identify this run on the manifest.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1.5">
                      Rider <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={riderId}
                      onChange={(e) => setRiderId(e.target.value)}
                      required
                      className={inputCls}
                    >
                      <option value="" className="bg-[#0c1522] text-stone-500">Select a rider...</option>
                      {riders.map((r) => (
                        <option key={r.id} value={r.id} className="bg-[#0c1522] text-white">
                          {r.name} · {r.vehicleType}
                          {r.ghostRate != null && r.ghostRate > 10 ? ` ⚠ ${r.ghostRate}% ghost` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-300 mb-1.5">
                        Distance <span className="text-stone-600 font-normal">(km)</span>
                      </label>
                      <input
                        type="number"
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(e.target.value)}
                        placeholder="e.g. 120"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-300 mb-1.5">
                        Rider fee <span className="text-stone-600 font-normal">(₦)</span>
                      </label>
                      <input
                        type="number"
                        value={riderFee}
                        onChange={(e) => setRiderFee(e.target.value)}
                        placeholder="e.g. 15000"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1.5">
                      Expected delivery <span className="text-stone-600 font-normal">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                      className={inputCls}
                    />
                    <p className="text-[10px] text-stone-600 mt-1">If set, the run is flagged as delayed once this date passes without completion.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1.5">Notes <span className="text-stone-600 font-normal">(optional)</span></label>
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Priority cargo, departs 8 AM"
                      className={inputCls}
                    />
                  </div>

                  {error && (
                    <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 px-5 py-3 border-t border-white/[0.06] shrink-0">
                  <button
                    onClick={() => setStep("route")}
                    className="flex-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 h-9 text-xs font-medium text-stone-400 hover:text-white hover:bg-white/[0.06] transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 h-9 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-60 transition-all"
                  >
                    {submitting
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating run...</>
                      : "Create run & add waybills →"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
