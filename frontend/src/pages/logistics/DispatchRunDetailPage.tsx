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

  useEffect(() => {
    if (handoverSecondsLeft <= 0) return;
    const t = setInterval(() => setHandoverSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [handoverSecondsLeft]);

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

  if (loading) return <div className="animate-pulse h-64 rounded-lg bg-white/[0.03] border border-white/[0.06]" />;
  if (!run) return <p className="text-sm text-stone-500">Run not found.</p>;

  const nextStatus = STATUS_TRANSITIONS[run.status];
  const isLocked = run.status !== "loading";
  const inputCls = "rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 h-8 text-sm text-white focus:outline-none focus:border-orange-500/40 transition-colors";

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to runs
      </button>

      {/* Run header */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${run.status === "in_transit" ? "bg-blue-500/[0.12]" : run.status === "completed" ? "bg-emerald-500/[0.12]" : "bg-amber-500/[0.12]"}`}>
              {run.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> :
               run.status === "cancelled" ? <XCircle className="h-5 w-5 text-stone-500" /> :
               run.status === "in_transit" ? <Navigation className="h-5 w-5 text-blue-400" /> :
               <Clock className="h-5 w-5 text-amber-400" />}
            </div>
            <div className="min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus
                    placeholder="Run name (optional)"
                    className={`${inputCls} w-48`} />
                  <button onClick={handleSaveName} className="text-emerald-400 hover:text-emerald-300"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setEditingName(false)} className="text-stone-600 hover:text-stone-300"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-white">
                    {run.name || `Run — ${new Date(run.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}`}
                  </h2>
                  {!isLocked && (
                    <button onClick={() => setEditingName(true)} className="text-stone-600 hover:text-stone-300 transition-colors">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-stone-500 mt-0.5">{STATUS_LABELS[run.status]}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-stone-600">Total value</p>
            <p className="text-sm font-bold text-white">{formatNaira(run.totalValue)}</p>
            {run.totalCost > 0 && (
              <>
                <p className="text-[11px] text-stone-600 mt-1.5">Total cost</p>
                <p className="text-xs font-semibold text-stone-300">{formatNaira(run.totalCost)}</p>
              </>
            )}
          </div>
        </div>

        {(run.delayFlag || run.ghostingFlag) && (
          <div className={`rounded-lg border p-3 flex items-start gap-2 ${run.ghostingFlag ? "border-red-500/20 bg-red-500/[0.06]" : "border-amber-500/20 bg-amber-500/[0.06]"}`}>
            <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 ${run.ghostingFlag ? "text-red-400" : "text-amber-400"}`} />
            <div className="text-xs">
              <p className={`font-semibold ${run.ghostingFlag ? "text-red-300" : "text-amber-300"}`}>
                {run.ghostingFlag ? "Ghosting risk" : "Delayed"}
              </p>
              <p className={`mt-0.5 ${run.ghostingFlag ? "text-red-400/70" : "text-amber-400/70"}`}>
                {run.ghostingFlag
                  ? "No status update for an extended period. Contact the rider to confirm custody."
                  : `Past expected delivery date${run.expectedDeliveryDate ? ` (${new Date(run.expectedDeliveryDate).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })})` : ""}.`}
              </p>
            </div>
          </div>
        )}

        {(run.distanceKm > 0 || run.totalCost > 0) && (
          <div className="grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3 text-xs">
            <div>
              <p className="text-[11px] text-stone-600">Distance</p>
              <p className="font-medium text-stone-200">{run.distanceKm} km</p>
            </div>
            <div>
              <p className="text-[11px] text-stone-600">Fuel cost</p>
              <p className="font-medium text-stone-200">{formatNaira(run.fuelCost)}</p>
            </div>
            <div>
              <p className="text-[11px] text-stone-600">Rider fee</p>
              <p className="font-medium text-stone-200">{formatNaira(run.riderFee)}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3 text-xs">
          <div>
            <p className="text-[11px] text-stone-600">Rider</p>
            {editingRider ? (
              <div className="flex items-center gap-1 mt-0.5">
                <select
                  value={riderIdInput}
                  onChange={(e) => setRiderIdInput(e.target.value)}
                  autoFocus
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-1.5 h-7 text-xs text-white focus:outline-none focus:border-orange-500/40 flex-1 min-w-0"
                >
                  <option value="" className="bg-[#0c1522]">No rider</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id} className="bg-[#0c1522]">{r.name}</option>
                  ))}
                </select>
                <button onClick={handleSaveRider} className="text-emerald-400 hover:text-emerald-300 shrink-0"><Check className="h-3.5 w-3.5" /></button>
                <button onClick={() => setEditingRider(false)} className="text-stone-600 hover:text-stone-300 shrink-0"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="font-medium text-stone-200">{run.riderName || "—"}</p>
                {!isLocked && (
                  <button onClick={openRiderEdit} className="text-stone-600 hover:text-stone-300 transition-colors">
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
          <div>
            <p className="text-[11px] text-stone-600">Waybills</p>
            <p className="font-medium text-stone-200">{run.legCount}</p>
          </div>
          <div>
            <p className="text-[11px] text-stone-600">{run.departedAt ? "Departed" : run.completedAt ? "Completed" : "Created"}</p>
            <p className="font-medium text-stone-200">
              {new Date(run.departedAt ?? run.completedAt ?? run.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
            </p>
          </div>
        </div>

        {run.expectedDeliveryDate && (
          <div className="text-xs text-stone-500">
            <span className="text-[11px] text-stone-600">Expected delivery: </span>
            <span className="font-medium text-stone-300">
              {new Date(run.expectedDeliveryDate).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        )}

        {nextStatus && (
          <button onClick={() => handleStatusChange(nextStatus)} disabled={updating}
            className={["w-full inline-flex items-center justify-center gap-2 rounded-lg h-10 text-sm font-semibold transition-all disabled:opacity-60",
              nextStatus === "in_transit" ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-emerald-600 text-white hover:bg-emerald-700"].join(" ")}>
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : nextStatus === "in_transit" ? <Truck className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {nextStatus === "in_transit" ? "Depart — mark as in transit" : "Mark as completed"}
          </button>
        )}

        {(run.status === "loading" || run.status === "in_transit") && run.legs.length > 0 && run.legs.some((l) => l.handoverCount === 0) && (
          <div className="space-y-2">
            <button
              onClick={handleHandoverToDriver}
              disabled={handoverWorking}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/[0.08] text-purple-300 h-10 text-sm font-medium hover:bg-purple-500/[0.12] transition-all disabled:opacity-60"
            >
              {handoverWorking
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <QrCode className="h-4 w-4" />}
              Hand over {run.legs.length} shipment{run.legs.length !== 1 ? "s" : ""} to driver
            </button>
            {handoverError && (
              <p className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{handoverError}
              </p>
            )}
          </div>
        )}

        {run.status === "in_transit" && run.legs.length > 0 &&
          run.legs.every((l) => ["delivered", "failed", "ghosted"].includes(l.status)) && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-4 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-300">All shipments handed over</p>
              <p className="text-[11px] text-amber-400/70 mt-0.5">
                All {run.legs.length} shipments in this run have been delivered or closed.
              </p>
              <button
                onClick={() => handleStatusChange("completed")}
                disabled={updating}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 text-white px-3 h-7 text-xs font-semibold hover:bg-amber-700 disabled:opacity-60 transition-colors"
              >
                {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Mark run as completed
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Waybill legs */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <p className="text-xs font-medium text-stone-300">Waybills on this run</p>
          {!isLocked && (
            <button onClick={openAddPanel}
              className="inline-flex items-center gap-1.5 text-xs text-orange-400 font-medium hover:text-orange-300 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add waybill
            </button>
          )}
        </div>

        {showAddPanel && !isLocked && (
          <div className="border-b border-white/[0.06] bg-orange-500/[0.04] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-orange-400">Select a waybill to add</p>
              <button onClick={() => setShowAddPanel(false)} className="text-stone-600 hover:text-stone-300 transition-colors"><X className="h-3.5 w-3.5" /></button>
            </div>
            {availableWaybills.length === 0 ? (
              <p className="text-xs text-stone-500">No unassigned waybills. <Link to="/dashboard/waybills" className="text-orange-400 underline">Claim or join a waybill first.</Link></p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableWaybills.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-semibold text-stone-200 truncate">{w.waybillNumber}</p>
                      <p className="text-[11px] text-stone-500 truncate">{w.goodsDescription} · {w.pickupLocation} to {w.deliveryLocation}</p>
                    </div>
                    <button onClick={() => handleAddLeg(w.shipmentId!)} disabled={addingId === w.shipmentId}
                      className="ml-3 shrink-0 inline-flex items-center gap-1 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 text-white px-2.5 h-7 text-xs font-medium hover:shadow-orange-500/20 hover:shadow-sm transition-all disabled:opacity-60">
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
            <Package className="h-6 w-6 text-stone-600 mx-auto" />
            <p className="text-xs text-stone-500">No waybills loaded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {run.legs.map((leg) => (
              <div key={leg.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="h-8 w-8 rounded-md bg-white/[0.06] flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-stone-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {leg.waybillNumber ? (
                      <p className="text-xs font-mono font-semibold text-stone-200">{leg.waybillNumber}</p>
                    ) : null}
                    <Link to={`/dashboard/shipments/${leg.shipmentId}`}
                      className="text-stone-600 hover:text-orange-400 transition-colors shrink-0" title="View shipment">
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <p className="text-[11px] text-stone-500 truncate mt-0.5">
                    {leg.goodsDescription} · {leg.pickupLocation} to {leg.deliveryLocation}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <StatusBadge status={leg.status as ShipmentStatus} />
                    <span className="flex items-center gap-1 text-[10px] text-stone-500">
                      <ShieldCheck className="h-3 w-3" />{leg.handoverCount} Handover{leg.handoverCount !== 1 ? "s" : ""}
                    </span>
                    {leg.shipmentValue > 0 && (
                      <span className="text-[10px] text-stone-500">{formatNaira(leg.shipmentValue)}</span>
                    )}
                  </div>
                </div>
                {(run.status === "loading" || (run.status === "in_transit" && leg.handoverCount === 0)) && (
                  <button onClick={() => handleRemoveLeg(leg.shipmentId)} disabled={removingId === leg.shipmentId}
                    className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-stone-600 hover:bg-red-500/[0.1] hover:text-red-400 transition-colors disabled:opacity-40">
                    {removingId === leg.shipmentId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {run.notes && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-stone-200">{run.notes}</p>
        </div>
      )}

      {/* Run handover QR modal */}
      {handoverQrOpen && handoverToken && (() => {
        const scanUrl = `${window.location.origin}/scan?token=${handoverToken}`;
        const mins = Math.floor(handoverSecondsLeft / 60);
        const secs = handoverSecondsLeft % 60;
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full sm:max-w-sm rounded-t-xl sm:rounded-xl border border-white/[0.08] bg-[#0c1522] shadow-2xl shadow-black/40 overflow-hidden">
              <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.06]">
                <div>
                  <p className="text-sm font-semibold text-white">Driver handover QR</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {run.legs.length} shipment{run.legs.length !== 1 ? "s" : ""} · driver scans to confirm custody
                  </p>
                </div>
                <button onClick={() => setHandoverQrOpen(false)} className="text-stone-600 hover:text-stone-300 mt-0.5 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 flex flex-col items-center gap-4">
                {handoverConfirmed ? (
                  <>
                    <div className="h-16 w-16 rounded-full bg-emerald-500/[0.15] flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">Handover confirmed</p>
                      <p className="text-[11px] text-stone-500 mt-1">
                        All {run.legs.length} shipment{run.legs.length !== 1 ? "s" : ""} transferred to driver. Closing...
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg border border-white/[0.08] p-3 bg-white">
                      <QRCodeSVG value={scanUrl} size={200} />
                    </div>
                    {handoverSecondsLeft > 0 ? (
                      <p className="text-xs font-medium text-amber-400">
                        Expires in {mins}:{String(secs).padStart(2, "0")}
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-red-400">Expired</p>
                    )}
                    <div className="w-full space-y-2">
                      <button
                        onClick={async () => { await navigator.clipboard.writeText(scanUrl); }}
                        disabled={handoverSecondsLeft === 0}
                        className="w-full inline-flex items-center justify-center rounded-lg border border-white/[0.06] h-9 text-xs text-stone-500 hover:text-stone-300 disabled:opacity-40 transition-colors"
                      >
                        Copy link to share
                      </button>
                      {handoverSecondsLeft === 0 && (
                        <button
                          onClick={() => { setHandoverQrOpen(false); setHandoverToken(null); }}
                          className="w-full inline-flex items-center justify-center rounded-lg bg-purple-600 text-white h-9 text-xs font-semibold hover:bg-purple-700 transition-colors"
                        >
                          Generate new code
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-600 text-center">
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
