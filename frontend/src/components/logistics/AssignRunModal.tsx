import { useEffect, useState } from "react";
import { Loader2, Plus, Truck, X } from "lucide-react";
import { runsApi, type DispatchRun } from "@/services/runs";
import { useNavigate } from "react-router-dom";

interface Props {
  shipmentId: string;
  waybillNumber: string;
  onClose: () => void;
}

export default function AssignRunModal({ shipmentId, waybillNumber, onClose }: Props) {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<DispatchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [view, setView] = useState<"choose" | "new">("choose");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    runsApi.list()
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        setRuns(all.filter((r) => r.status === "loading"));
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
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to add to run.");
      setWorking(false);
    }
  }

  async function handleCreateRun() {
    setWorking(true);
    setError("");
    try {
      const run = await runsApi.create({ name: newName || undefined });
      await runsApi.addLeg(run.id, shipmentId);
      navigate(`/dashboard/runs/${run.id}`);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to create run.");
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">Assign to a dispatch run</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{waybillNumber}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {view === "choose" ? (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : runs.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground">Add to an existing run still loading at dock:</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {runs.map((run) => (
                      <button
                        key={run.id}
                        onClick={() => handleAddToRun(run.id)}
                        disabled={working}
                        className="w-full flex items-center justify-between rounded-lg border border-border bg-stone-50 px-3 py-2.5 text-left hover:bg-orange-50 hover:border-orange-300 transition-colors disabled:opacity-60"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {run.name || `Run — ${new Date(run.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}`}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {run.legCount} waybill{run.legCount !== 1 ? "s" : ""} · loading
                          </p>
                        </div>
                        <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
                <p className="text-xs text-muted-foreground">No runs currently loading at dock.</p>
              )}

              <button
                onClick={() => setView("new")}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-orange-300 bg-orange-50 text-orange-700 h-9 text-xs font-medium hover:bg-orange-100 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Start a new dispatch run
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Give this run a name (optional):</p>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Morning Lagos run"
                className="w-full rounded-md border border-input bg-white px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateRun}
                  disabled={working}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-orange-600 text-white h-9 text-xs font-semibold hover:bg-orange-700 transition-colors disabled:opacity-60"
                >
                  {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                  Create & assign
                </button>
                <button
                  onClick={() => setView("choose")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2"
                >
                  Back
                </button>
              </div>
            </>
          )}

          {error && (
            <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
