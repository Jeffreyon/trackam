import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Truck, Package, Navigation, CheckCircle2, XCircle,
  Clock, Loader2, Trash2, Plus, ShieldCheck, ExternalLink, Edit2, X, Check,
} from "lucide-react";
import { runsApi, type DispatchRunDetail, type RunStatus } from "@/services/runs";
import { waybillApi, type OperatorWaybill } from "@/services/handover";
import { formatNaira } from "@/lib/format";
import { StatusBadge } from "@/components/logistics/StatusBadge";
import type { ShipmentStatus } from "@/services/logistics";

const STATUS_TRANSITIONS: Partial<Record<RunStatus, RunStatus>> = {
  loading: "in_transit",
  in_transit: "completed",
};

const STATUS_LABELS: Record<RunStatus, string> = {
  loading: "Loading at dock",
  in_transit: "In transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function DispatchRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<DispatchRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [availableWaybills, setAvailableWaybills] = useState<OperatorWaybill[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  async function loadRun() {
    if (!id) return;
    const data = await runsApi.get(id);
    if (!data || typeof data !== "object") return;
    // Ensure legs is always an array, even if API returns null/undefined
    const safe = { ...data, legs: Array.isArray(data.legs) ? data.legs : [] };
    setRun(safe);
    setNameInput(safe.name ?? "");
  }

  useEffect(() => { loadRun().finally(() => setLoading(false)); }, [id]);

  async function handleStatusChange(next: RunStatus) {
    if (!id) return;
    setUpdating(true);
    try {
      const updated = await runsApi.updateStatus(id, next);
      setRun((prev) => prev ? { ...prev, ...updated } : prev);
    } finally {
      setUpdating(false);
    }
  }

  async function handleRemoveLeg(shipmentId: string) {
    if (!id) return;
    setRemovingId(shipmentId);
    try {
      const rawUpdated = await runsApi.removeLeg(id, shipmentId);
      if (rawUpdated && typeof rawUpdated === "object") {
        setRun({ ...rawUpdated, legs: Array.isArray(rawUpdated.legs) ? rawUpdated.legs : [] });
      }
    } finally {
      setRemovingId(null);
    }
  }

  async function handleAddLeg(shipmentId: string) {
    if (!id) return;
    setAddingId(shipmentId);
    try {
      const rawUpdated = await runsApi.addLeg(id, shipmentId);
      const updated = rawUpdated ? { ...rawUpdated, legs: Array.isArray(rawUpdated.legs) ? rawUpdated.legs : [] } : null;
      setRun(updated);
      const fresh = await waybillApi.list();
      const freshArr = Array.isArray(fresh) ? fresh : [];
      setAvailableWaybills(freshArr.filter((w) => !w.runId && w.shipmentId && (updated?.legs ?? []).every((l) => l.shipmentId !== w.shipmentId)));
    } finally {
      setAddingId(null);
    }
  }

  async function openAddPanel() {
    setShowAddPanel(true);
    const rawAll = await waybillApi.list();
    const all = Array.isArray(rawAll) ? rawAll : [];
    const currentIds = new Set((run?.legs ?? []).map((l) => l.shipmentId));
    setAvailableWaybills(all.filter((w) => w.shipmentId && !w.runId && !currentIds.has(w.shipmentId!)));
  }

  async function handleSaveName() {
    if (!id) return;
    await runsApi.update(id, { name: nameInput || undefined });
    setRun((prev) => prev ? { ...prev, name: nameInput || null } : prev);
    setEditingName(false);
  }

  if (loading) return <div className="animate-pulse h-64 rounded-lg bg-stone-100" />;
  if (!run) return <p className="text-sm text-muted-foreground">Run not found.</p>;

  const nextStatus = STATUS_TRANSITIONS[run.status];
  const isLocked = run.status !== "loading";

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to runs
      </button>

      {/* Run header */}
      <div className="rounded-lg border border-border bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${run.status === "in_transit" ? "bg-blue-100" : run.status === "completed" ? "bg-green-100" : "bg-amber-100"}`}>
              {run.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-green-600" /> :
               run.status === "cancelled" ? <XCircle className="h-5 w-5 text-stone-500" /> :
               run.status === "in_transit" ? <Navigation className="h-5 w-5 text-blue-600" /> :
               <Clock className="h-5 w-5 text-amber-600" />}
            </div>
            <div className="min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus
                    placeholder="Run name (optional)"
                    className="rounded-md border border-input px-2 h-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-48" />
                  <button onClick={handleSaveName} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setEditingName(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">
                    {run.name || `Run — ${new Date(run.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}`}
                  </h2>
                  {!isLocked && (
                    <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{STATUS_LABELS[run.status]}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-muted-foreground">Total value</p>
            <p className="text-sm font-bold text-foreground">{formatNaira(run.totalValue)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs">
          <div>
            <p className="text-[11px] text-muted-foreground">Rider</p>
            <p className="font-medium text-foreground">{run.riderName || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Waybills</p>
            <p className="font-medium text-foreground">{run.legCount}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">{run.departedAt ? "Departed" : run.completedAt ? "Completed" : "Created"}</p>
            <p className="font-medium text-foreground">
              {new Date(run.departedAt ?? run.completedAt ?? run.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
            </p>
          </div>
        </div>

        {nextStatus && (
          <button onClick={() => handleStatusChange(nextStatus)} disabled={updating}
            className={["w-full inline-flex items-center justify-center gap-2 rounded-md h-10 text-sm font-semibold transition-colors disabled:opacity-60",
              nextStatus === "in_transit" ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-green-600 text-white hover:bg-green-700"].join(" ")}>
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : nextStatus === "in_transit" ? <Truck className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {nextStatus === "in_transit" ? "Depart — mark as in transit" : "Mark as completed"}
          </button>
        )}
      </div>

      {/* Waybill legs */}
      <div className="rounded-lg border border-border bg-white shadow-xs">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-xs font-medium text-foreground">Waybills on this run</p>
          {!isLocked && (
            <button onClick={openAddPanel}
              className="inline-flex items-center gap-1.5 text-xs text-orange-700 font-medium hover:text-orange-800 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add waybill
            </button>
          )}
        </div>

        {/* Add panel */}
        {showAddPanel && !isLocked && (
          <div className="border-b border-border bg-orange-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-orange-900">Select a waybill to add</p>
              <button onClick={() => setShowAddPanel(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
            {availableWaybills.length === 0 ? (
              <p className="text-xs text-muted-foreground">No unassigned waybills. <Link to="/dashboard/waybills" className="text-orange-700 underline">Claim or join a waybill first.</Link></p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableWaybills.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-semibold text-foreground truncate">{w.waybillNumber}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{w.goodsDescription} · {w.pickupLocation} to {w.deliveryLocation}</p>
                    </div>
                    <button onClick={() => handleAddLeg(w.shipmentId!)} disabled={addingId === w.shipmentId}
                      className="ml-3 shrink-0 inline-flex items-center gap-1 rounded-md bg-orange-600 text-white px-2.5 h-7 text-xs font-medium hover:bg-orange-700 transition-colors disabled:opacity-60">
                      {addingId === w.shipmentId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {run.legs.length === 0 ? (
          <div className="py-12 text-center space-y-1">
            <Package className="h-6 w-6 text-muted-foreground/40 mx-auto" />
            <p className="text-xs text-muted-foreground">No waybills loaded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {run.legs.map((leg) => (
              <div key={leg.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {leg.waybillNumber ? (
                      <p className="text-xs font-mono font-semibold text-foreground">{leg.waybillNumber}</p>
                    ) : null}
                    <Link to={`/dashboard/shipments/${leg.shipmentId}`}
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0" title="View shipment">
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {leg.goodsDescription} · {leg.pickupLocation} to {leg.deliveryLocation}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <StatusBadge status={leg.status as ShipmentStatus} />
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <ShieldCheck className="h-3 w-3" />{leg.handoverCount} PoH
                    </span>
                    {leg.shipmentValue > 0 && (
                      <span className="text-[10px] text-muted-foreground">{formatNaira(leg.shipmentValue)}</span>
                    )}
                  </div>
                </div>
                {!isLocked && (
                  <button onClick={() => handleRemoveLeg(leg.shipmentId)} disabled={removingId === leg.shipmentId}
                    className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40">
                    {removingId === leg.shipmentId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {run.notes && (
        <div className="rounded-lg border border-border bg-white p-4 shadow-xs">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-foreground">{run.notes}</p>
        </div>
      )}
    </div>
  );
}