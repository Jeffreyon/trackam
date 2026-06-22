import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Package, CheckCircle2, Navigation, XCircle, Clock, AlertCircle } from "lucide-react";
import { runsApi, type DispatchRun, type RunStatus } from "@/services/runs";
import { formatNaira } from "@/lib/format";
import { QuickDispatch } from "@/components/logistics/QuickDispatch";

const STATUS_CONFIG: Record<RunStatus, { label: string; dot: string; badge: string }> = {
  loading:      { label: "Loading at dock", dot: "bg-amber-500",   badge: "bg-amber-500/[0.1] text-amber-400 border-amber-500/20" },
  in_transit:   { label: "In transit",      dot: "bg-blue-500",    badge: "bg-blue-500/[0.1] text-blue-400 border-blue-500/20" },
  with_carrier: { label: "With carrier",    dot: "bg-orange-500",  badge: "bg-orange-500/[0.1] text-orange-400 border-orange-500/20" },
  completed:    { label: "Completed",       dot: "bg-emerald-500", badge: "bg-emerald-500/[0.1] text-emerald-400 border-emerald-500/20" },
  cancelled:    { label: "Cancelled",       dot: "bg-stone-500",   badge: "bg-stone-500/[0.12] text-stone-400 border-stone-500/20" },
};

type Filter = "all" | "loading" | "in_transit" | "completed";

export default function DispatchRunsPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<DispatchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => {
    load();
  }, []);

  function load() {
    runsApi.list()
      .then((data) => setRuns(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  const filtered = runs.filter((r) => filter === "all" || r.status === filter);

  const counts = {
    all: runs.length,
    loading: runs.filter((r) => r.status === "loading").length,
    in_transit: runs.filter((r) => r.status === "in_transit").length,
    completed: runs.filter((r) => r.status === "completed").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
          {(["all", "loading", "in_transit", "completed"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={["rounded-md px-3 h-7 text-xs font-medium transition-colors",
                filter === f ? "bg-white/[0.1] text-white" : "text-stone-500 hover:text-stone-300"].join(" ")}>
              {f === "all" ? "All" : f === "in_transit" ? "In transit" : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-1.5 text-[10px] text-stone-600">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-white/[0.03] border border-white/[0.06] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.03] py-16 text-center space-y-2">
          <div className="flex justify-center"><div className="h-10 w-10 rounded-lg bg-white/[0.06] flex items-center justify-center"><Truck className="h-5 w-5 text-stone-500" /></div></div>
          <p className="text-sm font-medium text-stone-300">{runs.length === 0 ? "No dispatch runs yet" : "No runs match this filter"}</p>
          <p className="text-xs text-stone-500">{runs.length === 0 ? "Create a new run, then load waybills onto it before departure." : "Try a different filter."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((run) => {
            const cfg = STATUS_CONFIG[run.status];
            return (
              <button key={run.id} onClick={() => navigate(`/dashboard/runs/${run.id}`)}
                className="w-full text-left rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 hover:bg-white/[0.05] hover:border-orange-500/20 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${run.status === "in_transit" ? "bg-blue-500/[0.12]" : run.status === "completed" ? "bg-emerald-500/[0.12]" : run.status === "with_carrier" ? "bg-orange-500/[0.12]" : "bg-amber-500/[0.12]"}`}>
                      {run.status === "completed"    ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> :
                       run.status === "cancelled"    ? <XCircle className="h-4 w-4 text-stone-500" /> :
                       run.status === "in_transit"   ? <Navigation className="h-4 w-4 text-blue-400" /> :
                       run.status === "with_carrier" ? <Truck className="h-4 w-4 text-orange-400" /> :
                       <Clock className="h-4 w-4 text-amber-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {run.name || `Run — ${new Date(run.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}`}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {run.riderName ? `${run.riderName} · ` : ""}{run.legCount} waybill{run.legCount !== 1 ? "s" : ""}
                        {run.departedAt ? ` · Departed ${new Date(run.departedAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {run.totalValue > 0 && (
                      <div className="text-right hidden sm:block">
                        <p className="text-[11px] text-stone-600">Total value</p>
                        <p className="text-xs font-semibold text-stone-200">{formatNaira(run.totalValue)}</p>
                      </div>
                    )}
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${cfg.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    {(run.ghostingFlag || run.delayFlag) && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${run.ghostingFlag ? "bg-red-500/[0.1] text-red-400 border-red-500/20" : "bg-amber-500/[0.1] text-amber-400 border-amber-500/20"}`}
                        title={run.ghostingFlag ? "No status update for extended period" : "Past expected delivery date"}
                      >
                        <AlertCircle className="h-3 w-3" />
                        {run.ghostingFlag ? "Ghosting" : "Delayed"}
                      </span>
                    )}
                  </div>
                </div>
                {run.legCount === 0 && run.status === "loading" && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3 py-2">
                    <Package className="h-3 w-3 shrink-0" /> No waybills loaded yet. Click to add waybills from your claimed list.
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <QuickDispatch onCreated={load} />
    </div>
  );
}
