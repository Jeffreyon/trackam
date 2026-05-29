import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Truck, Package, Navigation, CheckCircle2, XCircle,
  Clock, Loader2, Trash2, Plus, ShieldCheck, ExternalLink, Edit2, X, Check,
  QrCode, AlertCircle,
} from "lucide-react";
import { runsApi, type DispatchRunDetail, type RunStatus } from "@/services/runs";
import { waybillApi, handoverApi, type OperatorWaybill } from "@/services/handover";
import { ridersApi, type Rider } from "@/services/logistics";
import { QRCodeSVG } from "qrcode.react";
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
  const [editingRider, setEditingRider] = useState(false);
  const [riderIdInput, setRiderIdInput] = useState("");
  const [riders, setRiders] = useState<Rider[]>([]);

  // Run-level bulk handover to driver
  const [handoverQrOpen, setHandoverQrOpen] = useState(false);
  const [handoverToken, setHandoverToken] = useState<string | null>(null);
  const [handoverSecondsLeft, setHandoverSecondsLeft] = useState(0);
  const [handoverWorking, setHandoverWorking] = useState(false);
  const [handoverError, setHandoverError] = useState("");

  async function loadRun() {
    if (!id) return;
    const [data, waybills] = await Promise.all([
      runsApi.get(id),
      waybillApi.list().catch(() => [] as OperatorWaybill[]),
    ]);
    if (!data || typeof data !== "object") return;
    const legs = Array.isArray(data.legs) ? data.legs : [];

    // Enrich legs with OLI handover counts (local table may be empty)
    const waybillArr = Array.isArray(waybills) ? waybills : [];
    const oliMap = new Map(waybillArr.map((w) => [w.shipmentId, w]));
    const enriched = legs.map((leg) => {
      const oli = oliMap.get(leg.shipmentId);
      return {
        ...leg,
        handoverCount: oli?.handoverCount ?? leg.handoverCount ?? 0,
        isDelivered: oli?.isDelivered ?? false,
      };
    });

    const safe = { ...data, legs: enriched };
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

  // Countdown for run handover QR
  useEffect(() => {
    if (handoverSecondsLeft <= 0) return;
    const t = setInterval(() => setHandoverSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [handoverSecondsLeft]);

  // Poll for handover completion while QR modal is open
  const [handoverConfirmed, setHandoverConfirmed] = useState(false);
  useEffect(() => {
    if (!handoverQrOpen || !handoverToken || handoverConfirmed) return;
    const poll = setInterval(async () => {
      try {
        const waybills = await waybillApi.list();
        const arr = Array.isArray(waybills) ? waybills : [];
        const legShipmentIds = new Set((run?.legs ?? []).map((l) => l.shipmentId));
        const allHandedOver = arr
          .filter((w) => w.shipmentId && legShipmentIds.has(w.shipmentId))
          .every((w) => w.handoverCount > 0);
        if (allHandedOver && arr.length > 0) {
          setHandoverConfirmed(true);
          await loadRun();
          // Auto-close modal after a brief delay so user sees the confirmation
          setTimeout(() => {
            setHandoverQrOpen(false);
            setHandoverToken(null);
            setHandoverConfirmed(false);
          }, 3000);
        }
      } catch { /* ignore polling errors */ }
    }, 5000);
    return () => clearInterval(poll);
  }, [handoverQrOpen, handoverToken, handoverConfirmed]);

  async function handleHandoverToDriver() {
    if (!run?.legs.length) return;
    setHandoverWorking(true);
    setHandoverError("");
    try {
      const result = await handoverApi.initiateBulk({
        shipmentIds: run.legs.map((l) => l.shipmentId),
        receiverActorType: "ACTOR_COURIER",
        giverActorType: "ACTOR_HUB",
        runId: id,
        internal: false,
      });
      setHandoverToken(result.token);
      const secs = Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000);
      setHandoverSecondsLeft(secs);
      setHandoverQrOpen(true);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setHandoverError(
        status === 402
          ? "Insufficient wallet balance. Please top up your OLI Switch wallet and try again."
          : msg || "Failed to generate handover QR."
      );
    } finally {
      setHandoverWorking(false);
    }
  }

  async function openRiderEdit() {
    if (!riders.length) {
      const list = await ridersApi.list();
      setRiders(Array.isArray(list) ? list : []);
    }
    setRiderIdInput(run?.riderId ?? "");
    setEditingRider(true);
  }

  async function handleSaveRider() {
    if (!id) return;
    const updated = await runsApi.update(id, { riderId: riderIdInput || undefined });
    setRun((prev) => prev ? { ...prev, riderId: updated.riderId, riderName: updated.riderName } : prev);
    setEditingRider(false);
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
            {editingRider ? (
              <div className="flex items-center gap-1 mt-0.5">
                <select
                  value={riderIdInput}
                  onChange={(e) => setRiderIdInput(e.target.value)}
                  autoFocus
                  className="rounded border border-input px-1.5 h-7 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring flex-1 min-w-0"
                >
                  <option value="">No rider</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <button onClick={handleSaveRider} className="text-green-600 hover:text-green-700 shrink-0"><Check className="h-3.5 w-3.5" /></button>
                <button onClick={() => setEditingRider(false)} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="font-medium text-foreground">{run.riderName || "—"}</p>
                {!isLocked && (
                  <button onClick={openRiderEdit} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
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

        {/* Hand over all shipments to driver — hide once all legs have been handed over */}
        {run.status === "in_transit" && run.legs.length > 0 && run.legs.some((l) => l.handoverCount === 0) && (
          <div className="space-y-2">
            <button
              onClick={handleHandoverToDriver}
              disabled={handoverWorking}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-purple-300 bg-purple-50 text-purple-800 h-10 text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-60"
            >
              {handoverWorking
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <QrCode className="h-4 w-4" />}
              Hand over {run.legs.length} shipment{run.legs.length !== 1 ? "s" : ""} to driver
            </button>
            {handoverError && (
              <p className="flex items-center gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{handoverError}
              </p>
            )}
          </div>
        )}

        {/* Auto-complete prompt */}
        {run.status === "in_transit" && run.legs.length > 0 &&
          run.legs.every((l) => ["delivered", "failed", "ghosted"].includes(l.status)) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-900">All shipments handed over</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                All {run.legs.length} shipments in this run have been delivered or closed.
              </p>
              <button
                onClick={() => handleStatusChange("completed")}
                disabled={updating}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-700 text-white px-3 h-7 text-xs font-semibold hover:bg-amber-800 disabled:opacity-60"
              >
                {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Mark run as completed
              </button>
            </div>
          </div>
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
                      <ShieldCheck className="h-3 w-3" />{leg.handoverCount} Handover{leg.handoverCount !== 1 ? "s" : ""}
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

      {/* Run handover QR modal */}
      {handoverQrOpen && handoverToken && (() => {
        const scanUrl = `${window.location.origin}/scan?token=${handoverToken}`;
        const mins = Math.floor(handoverSecondsLeft / 60);
        const secs = handoverSecondsLeft % 60;
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40">
            <div className="relative w-full sm:max-w-sm rounded-t-xl sm:rounded-xl border border-border bg-white shadow-xl overflow-hidden">
              <div className="flex items-start justify-between px-5 py-4 border-b border-border">
                <div>
                  <p className="text-sm font-semibold text-foreground">Driver handover QR</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {run.legs.length} shipment{run.legs.length !== 1 ? "s" : ""} · driver scans to confirm custody
                  </p>
                </div>
                <button onClick={() => setHandoverQrOpen(false)} className="text-muted-foreground hover:text-foreground mt-0.5">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 flex flex-col items-center gap-4">
                {handoverConfirmed ? (
                  <>
                    <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">Handover confirmed</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        All {run.legs.length} shipment{run.legs.length !== 1 ? "s" : ""} transferred to driver. Closing...
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg border border-border p-3 bg-white">
                      <QRCodeSVG value={scanUrl} size={200} />
                    </div>
                    {handoverSecondsLeft > 0 ? (
                      <p className="text-xs font-medium text-amber-700">
                        Expires in {mins}:{String(secs).padStart(2, "0")}
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-red-600">Expired</p>
                    )}
                    <div className="w-full space-y-2">
                      <button
                        onClick={async () => { await navigator.clipboard.writeText(scanUrl); }}
                        disabled={handoverSecondsLeft === 0}
                        className="w-full inline-flex items-center justify-center rounded-md border border-border h-9 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        Copy link to share
                      </button>
                      {handoverSecondsLeft === 0 && (
                        <button
                          onClick={() => { setHandoverQrOpen(false); setHandoverToken(null); }}
                          className="w-full inline-flex items-center justify-center rounded-md bg-purple-700 text-white h-9 text-xs font-semibold hover:bg-purple-800"
                        >
                          Generate new code
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground text-center">
                      The driver will receive a custody link via SMS after scanning.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}