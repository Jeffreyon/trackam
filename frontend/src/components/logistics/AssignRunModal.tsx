import { useEffect, useState } from "react";
import { Loader2, Truck, X, User, AlertCircle, ChevronRight, Plus } from "lucide-react";
import { runsApi, type DispatchRun } from "@/services/runs";
import { ridersApi, type Rider } from "@/services/logistics";
import { useNavigate } from "react-router-dom";

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
    setWorking(true);
    setError("");
    try {
      const run = await runsApi.create({
        name: newName.trim() || undefined,
        riderId: newRiderId || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-white shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">Assign to a run</p>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{waybillNumber}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* ── Choose existing run ───────────────────────────────── */}
          {view === "choose" && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : runs.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground">Add to a run currently loading at dock:</p>
                  <div className="space-y-2 max-h-52 overflow-y-auto -mx-1 px-1">
                    {runs.map((run) => (
                      <button
                        key={run.id}
                        onClick={() => handleAddToRun(run.id)}
                        disabled={working}
                        className="w-full flex items-center gap-3 rounded-lg border border-border bg-stone-50 px-3 py-2.5 text-left hover:bg-orange-50 hover:border-orange-200 transition-colors disabled:opacity-60 group"
                      >
                        {/* Icon */}
                        <div className="h-8 w-8 rounded-md bg-amber-100 flex items-center justify-center shrink-0">
                          <Truck className="h-3.5 w-3.5 text-amber-600" />
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">
                            {run.name || `Run — ${new Date(run.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}`}
                          </p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
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

                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-orange-600 transition-colors" />
                      </button>
                    ))}
                  </div>

                  <div className="relative flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">or</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground pb-1">No runs currently loading at dock.</p>
              )}

              <button
                onClick={() => setView("new")}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-orange-300 bg-orange-50 text-orange-700 h-9 text-xs font-medium hover:bg-orange-100 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Start a new dispatch run
              </button>
            </>
          )}

          {/* ── Create new run ────────────────────────────────────── */}
          {view === "new" && (
            <>
              <p className="text-xs text-muted-foreground">Set up a new run, then add this waybill to it:</p>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1.5">Run name <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Morning Lagos run"
                  className="w-full rounded-md border border-input bg-white px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1.5">Rider <span className="text-muted-foreground font-normal">(optional)</span></label>
                <select
                  value={newRiderId}
                  onChange={(e) => setNewRiderId(e.target.value)}
                  className="w-full rounded-md border border-input bg-white px-3 h-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">No rider yet</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · {r.vehicleType}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreateRun}
                  disabled={working}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-orange-600 text-white h-9 text-xs font-semibold hover:bg-orange-700 transition-colors disabled:opacity-60"
                >
                  {working
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Truck className="h-3.5 w-3.5" />}
                  Create & assign
                </button>
                <button
                  onClick={() => { setView("choose"); setError(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2"
                >
                  Back
                </button>
              </div>
            </>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
