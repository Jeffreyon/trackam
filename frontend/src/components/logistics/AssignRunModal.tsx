import { useEffect, useState } from "react";
import { Loader2, Truck, X, User, AlertCircle, ChevronRight, Plus } from "lucide-react";
import { runsApi, type DispatchRun } from "@/services/runs";
import { ridersApi, type Rider } from "@/services/logistics";
import { useNavigate } from "react-router-dom";
import { CityAutocomplete } from "@/components/common/CityAutocomplete";

interface Props {
  shipmentId: string;
  waybillNumber: string;
  onClose: () => void;
}

type View = "choose" | "new";

export default function AssignRunModal({ shipmentId, waybillNumber, onClose }: Props) {
  const navigate = useNavigate();

  const [runs, setRuns] = useState<DispatchRun[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [view, setView] = useState<View>("choose");
  const [error, setError] = useState("");

  // "New run" form fields
  const [newName, setNewName] = useState("");
  const [newRiderId, setNewRiderId] = useState("");
  const [newOriginCity, setNewOriginCity] = useState("");
  const [newDestCity, setNewDestCity] = useState("");
  const [newDistanceKm, setNewDistanceKm] = useState("");
  const [newRiderFee, setNewRiderFee] = useState("");
  const [newExpectedDate, setNewExpectedDate] = useState("");

  useEffect(() => {
    Promise.all([runsApi.list(), ridersApi.list()])
      .then(([allRuns, allRiders]) => {
        setRuns((Array.isArray(allRuns) ? allRuns : []).filter((r) => r.status === "loading"));
        setRiders(Array.isArray(allRiders) ? allRiders : []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAddToRun(runId: string) {
    setWorking(true);
    setError("");
    try {
      await runsApi.addLeg(runId, shipmentId);
      navigate(`/dashboard/runs/${runId}`);
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to add to run."
      );
      setWorking(false);
    }
  }

  async function handleCreateRun() {
    if (!newRiderId) {
      setError("Please select a rider before creating the run.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const run = await runsApi.create({
        name: newName.trim() || undefined,
        riderId: newRiderId,
        originCity: newOriginCity.trim() || undefined,
        destCity: newDestCity.trim() || undefined,
        distanceKm: newDistanceKm ? parseInt(newDistanceKm, 10) : undefined,
        riderFee: newRiderFee ? parseInt(newRiderFee, 10) : undefined,
        expectedDeliveryDate: newExpectedDate || undefined,
      });
      await runsApi.addLeg(run.id, shipmentId);
      navigate(`/dashboard/runs/${run.id}`);
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create run."
      );
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full sm:max-w-sm rounded-t-xl sm:rounded-xl border border-white/[0.08] bg-[#0c1522] shadow-2xl shadow-black/40 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <p className="text-sm font-semibold text-white">Assign to a run</p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">{waybillNumber}</p>
          </div>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* ── Choose existing run ───────────────────────────────── */}
          {view === "choose" && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-stone-600" />
                </div>
              ) : runs.length > 0 ? (
                <>
                  <p className="text-xs text-stone-500">Add to a run currently loading at dock:</p>
                  <div className="space-y-2 max-h-52 overflow-y-auto -mx-1 px-1">
                    {runs.map((run) => (
                      <button
                        key={run.id}
                        onClick={() => handleAddToRun(run.id)}
                        disabled={working}
                        className="w-full flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left hover:bg-orange-500/[0.06] hover:border-orange-500/20 transition-all disabled:opacity-60 group"
                      >
                        {/* Icon */}
                        <div className="h-8 w-8 rounded-lg bg-amber-500/[0.12] flex items-center justify-center shrink-0">
                          <Truck className="h-3.5 w-3.5 text-amber-400" />
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-stone-200 truncate">
                            {run.name || `Run — ${new Date(run.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}`}
                          </p>
                          <p className="text-[11px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                            {run.riderName && (
                              <>
                                <User className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{run.riderName}</span>
                                <span>·</span>
                              </>
                            )}
                            {run.legCount} waybill{run.legCount !== 1 ? "s" : ""}
                          </p>
                        </div>

                        <ChevronRight className="h-3.5 w-3.5 text-stone-600 shrink-0 group-hover:text-orange-400 transition-colors" />
                      </button>
                    ))}
                  </div>

                  <div className="relative flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    <span className="text-[10px] text-stone-600 uppercase tracking-wide">or</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>
                </>
              ) : (
                <p className="text-xs text-stone-500 pb-1">No runs currently loading at dock.</p>
              )}

              <button
                onClick={() => setView("new")}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-orange-500/30 bg-orange-500/[0.06] text-orange-400 h-9 text-xs font-medium hover:bg-orange-500/[0.1] transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Start a new dispatch run
              </button>
            </>
          )}

          {/* ── Create new run ────────────────────────────────────── */}
          {view === "new" && (
            <>
              <p className="text-xs text-stone-500">Set up a new run, then add this waybill to it:</p>

              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-0.5">
                <div>
                  <label className="block text-[11px] font-medium text-stone-300 mb-1.5">Run name <span className="text-stone-600 font-normal">(optional)</span></label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Morning Lagos run"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-300 mb-1.5">
                    Rider <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={newRiderId}
                    onChange={(e) => setNewRiderId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white focus:outline-none focus:border-orange-500/40 transition-colors"
                  >
                    <option value="" className="bg-[#0c1522] text-stone-500">Select a rider...</option>
                    {riders.map((r) => (
                      <option key={r.id} value={r.id} className="bg-[#0c1522] text-white">
                        {r.name} · {r.vehicleType}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-300 mb-1.5">Origin city</label>
                    <CityAutocomplete
                      value={newOriginCity}
                      onChange={setNewOriginCity}
                      placeholder="e.g. Lagos"
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-300 mb-1.5">Dest city</label>
                    <CityAutocomplete
                      value={newDestCity}
                      onChange={setNewDestCity}
                      placeholder="e.g. Abuja"
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-300 mb-1.5">Distance <span className="text-stone-600">(km)</span></label>
                    <input
                      type="number"
                      value={newDistanceKm}
                      onChange={(e) => setNewDistanceKm(e.target.value)}
                      placeholder="e.g. 120"
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-300 mb-1.5">Rider fee <span className="text-stone-600">(₦)</span></label>
                    <input
                      type="number"
                      value={newRiderFee}
                      onChange={(e) => setNewRiderFee(e.target.value)}
                      placeholder="e.g. 15000"
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-300 mb-1.5">Expected delivery <span className="text-stone-600">(optional)</span></label>
                  <input
                    type="date"
                    value={newExpectedDate}
                    onChange={(e) => setNewExpectedDate(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white focus:outline-none focus:border-orange-500/40 transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreateRun}
                  disabled={working}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 text-white h-9 text-xs font-semibold shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 transition-all disabled:opacity-60"
                >
                  {working
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Truck className="h-3.5 w-3.5" />}
                  Create & assign
                </button>
                <button
                  onClick={() => { setView("choose"); setError(""); }}
                  className="text-xs text-stone-500 hover:text-stone-300 transition-colors px-2"
                >
                  Back
                </button>
              </div>
            </>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
