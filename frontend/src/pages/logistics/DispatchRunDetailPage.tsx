import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Truck, Package, Navigation, CheckCircle2, XCircle,
  Clock, Loader2, Trash2, Plus, ShieldCheck, ExternalLink, Edit2, X, Check,
  QrCode, AlertCircle, Globe, ArrowRight, Building2,
} from "lucide-react";
import { runsApi, type DispatchRunDetail, type RunStatus } from "@/services/runs";
import { waybillApi, handoverApi, type OperatorWaybill } from "@/services/handover";
import { triggerWalletRefresh } from "@/components/layout/WalletWidget";
import { ridersApi, type Rider } from "@/services/logistics";
import { networkRateApi, runBookingApi, type NetworkRate, type RunBooking } from "@/services/carrier";
import { CityAutocomplete } from "@/components/common/CityAutocomplete";
import { QRCodeSVG } from "qrcode.react";
import { formatNaira, formatNairaRaw } from "@/lib/format";
import { StatusBadge } from "@/components/logistics/StatusBadge";
import type { ShipmentStatus } from "@/services/logistics";


const STATUS_LABELS: Record<RunStatus, string> = {
  loading:      "Loading at dock",
  in_transit:   "In transit",
  with_carrier: "With carrier",
  completed:    "Completed",
  cancelled:    "Cancelled",
};

export default function DispatchRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<DispatchRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [availableWaybills, setAvailableWaybills] = useState<OperatorWaybill[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [editingRider, setEditingRider] = useState(false);
  const [riderIdInput, setRiderIdInput] = useState("");
  const [riders, setRiders] = useState<Rider[]>([]);
  const [editingCosts, setEditingCosts] = useState(false);
  const [distanceInput, setDistanceInput] = useState("");
  const [riderFeeInput, setRiderFeeInput] = useState("");

  const [handoverQrOpen, setHandoverQrOpen] = useState(false);
  const [handoverToken, setHandoverToken] = useState<string | null>(null);
  const [handoverSecondsLeft, setHandoverSecondsLeft] = useState(0);
  const [handoverWorking, setHandoverWorking] = useState(false);
  const [handoverError, setHandoverError] = useState("");

  // Carrier dispatch state
  type DispatchStep = "cities" | "rates" | "confirm";
  const [dispatchOpen, setDispatchOpen]       = useState(false);
  const [dispatchStep, setDispatchStep]       = useState<DispatchStep>("cities");
  const [originCity, setOriginCity]           = useState("");
  const [destCity, setDestCity]               = useState("");
  const [rates, setRates]                     = useState<NetworkRate[]>([]);
  const [ratesLoading, setRatesLoading]       = useState(false);
  const [selectedRate, setSelectedRate]       = useState<NetworkRate | null>(null);
  const [dispatchWorking, setDispatchWorking] = useState(false);
  const [dispatchError, setDispatchError]     = useState("");
  const [runBooking, setRunBooking]           = useState<RunBooking | null>(null);
  const [dropoffQrOpen, setDropoffQrOpen]     = useState(false);

  // Pickup QR modal state (dynamic: countdown + polls for carrier scan)
  const [pickupQrOpen, setPickupQrOpen]           = useState(false);
  const [pickupSecondsLeft, setPickupSecondsLeft] = useState(0);
  const [pickupConfirmed, setPickupConfirmed]     = useState(false);

  // Stable ref so async callbacks can read the latest run without closure staleness
  const runRef = useRef<DispatchRunDetail | null>(null);
  useEffect(() => { runRef.current = run; }, [run]);

  async function loadRun() {
    if (!id) return;
    const [data, waybills, existingBooking] = await Promise.all([
      runsApi.get(id),
      waybillApi.list().catch(() => [] as OperatorWaybill[]),
      runBookingApi.getByRunId(id).catch(() => null),
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
    setRunBooking(existingBooking);
  }

  useEffect(() => { loadRun().finally(() => setLoading(false)); }, [id]);

  // Poll every 30 s while the booking is awaiting acceptance or in transit.
  // Stops automatically once the booking reaches a terminal status.
  const POLL_INTERVAL_MS = 30_000;
  const TERMINAL_STATUSES = ["received", "dispatched", "delivered", "rejected", "expired"];
  useEffect(() => {
    if (!runBooking || TERMINAL_STATUSES.includes(runBooking.status)) return;
    const timer = setInterval(() => {
      runBookingApi.getByRunId(id ?? "").then((updated) => {
        if (updated) setRunBooking(updated);
      }).catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [id, runBooking?.status]);

  async function handleSaveCosts() {
    if (!id) return;
    const updated = await runsApi.update(id, {
      distanceKm: distanceInput ? parseInt(distanceInput, 10) : 0,
      riderFee:   riderFeeInput ? parseInt(riderFeeInput, 10) : 0,
    });
    setRun((prev) => prev ? { ...prev, ...updated } : prev);
    setEditingCosts(false);
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

  // Refresh the wallet chip whenever the QR modal closes — covers both the
  // manual X dismiss and the auto-close after confirmation. More reliable than
  // calling triggerWalletRefresh inside the polling async callback, which can
  // race with the React re-render that clears the interval.
  const handoverQrOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = handoverQrOpenRef.current;
    handoverQrOpenRef.current = handoverQrOpen;
    if (wasOpen && !handoverQrOpen) {
      triggerWalletRefresh();
      loadRun().catch(() => {}); // refresh handover counts even on manual dismiss
    }
  }, [handoverQrOpen]);

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
          // Auto-advance run to in_transit when all shipments are handed to driver
          if (runRef.current?.status === "loading" && id) {
            const advanced = await runsApi.updateStatus(id, "in_transit").catch(() => null);
            if (advanced) setRun((prev) => prev ? { ...prev, ...advanced } : prev);
          }
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

  useEffect(() => {
    if (pickupSecondsLeft <= 0) return;
    const t = setInterval(() => setPickupSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [pickupSecondsLeft]);

  useEffect(() => {
    if (!pickupQrOpen || pickupConfirmed || !runBooking?.dropoffToken) return;
    const poll = setInterval(async () => {
      try {
        const info = await runBookingApi.getDropoffInfo(runBooking.dropoffToken!);
        if (info.status === "received") {
          setPickupConfirmed(true);
          await loadRun();
          setTimeout(() => {
            setPickupQrOpen(false);
            setPickupConfirmed(false);
          }, 3000);
        }
      } catch { /* ignore polling errors */ }
    }, 5000);
    return () => clearInterval(poll);
  }, [pickupQrOpen, pickupConfirmed, runBooking?.dropoffToken]);

  function openPickupQr() {
    setPickupConfirmed(false);
    setPickupSecondsLeft(5 * 60);
    setPickupQrOpen(true);
  }

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

  async function fetchRatesFor(origin: string, dest: string) {
    setDispatchError("");
    setRatesLoading(true);
    try {
      const distKm = run?.distanceKm ?? null;
      const fetched = await networkRateApi.check({
        origin:      { countryCode: "ng", cityName: origin.trim() },
        destination: { countryCode: "ng", cityName: dest.trim() },
        packages:    [{ weight: { value: 1, unit: "kg" } }],
        distanceKm:  distKm,
      });
      setRates(fetched.filter((r) => r.carrier === "trackam"));
      setDispatchStep("rates");
    } catch {
      setDispatchError("Could not fetch carrier rates. Try again.");
    } finally {
      setRatesLoading(false);
    }
  }

  function openDispatch() {
    const preOrigin = run?.originCity ?? "";
    const preDest   = run?.destCity ?? "";
    setOriginCity(preOrigin);
    setDestCity(preDest);
    setRates([]);
    setSelectedRate(null);
    setDispatchError("");
    setDispatchOpen(true);
    if (preOrigin && preDest) {
      setDispatchStep("rates");
      fetchRatesFor(preOrigin, preDest);
    } else {
      setDispatchStep("cities");
    }
  }

  async function handleFetchRates() {
    if (!originCity.trim() || !destCity.trim()) {
      setDispatchError("Enter both origin and destination cities.");
      return;
    }
    await fetchRatesFor(originCity, destCity);
  }

  async function handleDispatchToCarrier() {
    if (!selectedRate?.carrierId || !run?.legs.length) return;
    setDispatchWorking(true);
    setDispatchError("");
    try {
      const waybillIds = (run.legs ?? [])
        .map((l) => l.waybillId)
        .filter((w): w is string => Boolean(w));
      const booking = await runBookingApi.create({
        carrierOperatorId: selectedRate.carrierId,
        originCity:        originCity.trim(),
        destCity:          destCity.trim(),
        distanceKm:        run.distanceKm ?? undefined,
        quotedRateKobo:    Math.round(selectedRate.totalCharge.amount * 100),
        sourceRunId:       id,
        waybillIds,
      });
      setRunBooking(booking);
      setDispatchOpen(false);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setDispatchError(
        status === 402
          ? "Insufficient wallet balance. Top up your OLI Switch wallet and try again."
          : msg || "Failed to create booking. Try again."
      );
    } finally {
      setDispatchWorking(false);
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
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${run.status === "in_transit" ? "bg-blue-500/[0.12]" : run.status === "completed" ? "bg-emerald-500/[0.12]" : run.status === "with_carrier" ? "bg-orange-500/[0.12]" : "bg-amber-500/[0.12]"}`}>
              {run.status === "completed"    ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> :
               run.status === "cancelled"    ? <XCircle className="h-5 w-5 text-stone-500" /> :
               run.status === "in_transit"   ? <Navigation className="h-5 w-5 text-blue-400" /> :
               run.status === "with_carrier" ? <Truck className="h-5 w-5 text-orange-400" /> :
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
            <p className="text-[11px] text-stone-600">Total cost</p>
            <p className="text-sm font-bold text-white">{run.totalCost > 0 ? formatNaira(run.totalCost) : "—"}</p>
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

        <div className="grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3 text-xs">
          <div>
            <p className="text-[11px] text-stone-600">Distance</p>
            {editingCosts ? (
              <input
                type="number"
                value={distanceInput}
                onChange={(e) => setDistanceInput(e.target.value)}
                placeholder="km"
                className="mt-0.5 w-full rounded border border-white/[0.08] bg-white/[0.04] px-1.5 h-6 text-xs text-white focus:outline-none focus:border-orange-500/40"
              />
            ) : (
              <p className="font-medium text-stone-200">{run.distanceKm > 0 ? `${run.distanceKm} km` : "—"}</p>
            )}
          </div>
          <div>
            <p className="text-[11px] text-stone-600">Fuel cost</p>
            <p className="font-medium text-stone-200">{run.fuelCost > 0 ? formatNaira(run.fuelCost) : "—"}</p>
            {editingCosts && <p className="text-[10px] text-stone-600 mt-0.5">Auto from distance</p>}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <p className="text-[11px] text-stone-600">Rider fee</p>
              {!editingCosts && !isLocked && (
                <button
                  onClick={() => {
                    setDistanceInput(run.distanceKm > 0 ? String(run.distanceKm) : "");
                    setRiderFeeInput(run.riderFee > 0 ? String(Math.round(run.riderFee / 100)) : "");
                    setEditingCosts(true);
                  }}
                  className="text-stone-600 hover:text-stone-300 transition-colors"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              )}
            </div>
            {editingCosts ? (
              <div className="flex items-center gap-1 mt-0.5">
                <input
                  type="number"
                  value={riderFeeInput}
                  onChange={(e) => setRiderFeeInput(e.target.value)}
                  placeholder="₦"
                  className="w-full rounded border border-white/[0.08] bg-white/[0.04] px-1.5 h-6 text-xs text-white focus:outline-none focus:border-orange-500/40"
                />
                <button onClick={handleSaveCosts} className="text-emerald-400 hover:text-emerald-300 shrink-0"><Check className="h-3.5 w-3.5" /></button>
                <button onClick={() => setEditingCosts(false)} className="text-stone-600 hover:text-stone-300 shrink-0"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <p className="font-medium text-stone-200">{run.riderFee > 0 ? formatNaira(run.riderFee) : "—"}</p>
            )}
          </div>
        </div>

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

        {(run.status === "loading" || run.status === "in_transit") && (() => {
          const noLegs = run.legs.length === 0;
          const hasUnhandled = noLegs || run.legs.some((l) => l.handoverCount === 0);
          const allHandedOver = !noLegs && !hasUnhandled;
          const isDropoffAccepted = runBooking?.status === "accepted" && !!runBooking.dropoffToken;
          const show = hasUnhandled || isDropoffAccepted;
          if (!show) return null;

          return (
            <div className="space-y-2">
              <div className={`grid gap-2 ${hasUnhandled ? "grid-cols-2" : "grid-cols-1"}`}>

                {/* Internal handover — only while some legs still unhandled */}
                {hasUnhandled && (
                  <button
                    onClick={handleHandoverToDriver}
                    disabled={handoverWorking || noLegs}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/[0.08] text-purple-300 h-12 text-sm font-medium hover:bg-purple-500/[0.12] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {handoverWorking
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <QrCode className="h-4 w-4" />}
                    Hand to driver
                  </button>
                )}

                {/* Carrier slot — state-driven */}
                {!runBooking ? (
                  <button
                    onClick={openDispatch}
                    disabled={noLegs}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/[0.08] text-blue-300 h-12 px-3 text-sm font-medium hover:bg-blue-500/[0.12] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Globe className="h-4 w-4 shrink-0" />
                    Dispatch to carrier
                  </button>
                ) : runBooking.status === "pending" ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 h-12 cursor-default">
                    <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-xs font-semibold text-amber-300 truncate">Awaiting acceptance</p>
                      <p className="text-[10px] text-stone-500 truncate">{runBooking.carrierName ?? "Carrier"}</p>
                    </div>
                  </div>
                ) : runBooking.status === "accepted" && runBooking.dropoffToken ? (
                  runBooking.handoverMode === "pickup" ? (
                    // Pickup: carrier's rider comes to booker's hub — show dynamic QR with countdown
                    <button
                      onClick={openPickupQr}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/[0.08] text-blue-300 h-12 px-3 hover:bg-blue-500/[0.12] transition-all"
                    >
                      <Truck className="h-4 w-4 shrink-0" />
                      <div className="text-left min-w-0">
                        <p className="text-xs font-semibold truncate">Show Pickup QR</p>
                        <p className="text-[10px] text-stone-500 truncate">Carrier rider scans at your location</p>
                      </div>
                    </button>
                  ) : allHandedOver ? (
                    // Dropoff: rider has custody and is heading to carrier hub.
                    // Only the rider can show the QR (from their custodian session link).
                    <div className="inline-flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-3 h-12 cursor-default">
                      <Truck className="h-4 w-4 text-blue-400 shrink-0" />
                      <div className="text-left min-w-0">
                        <p className="text-xs font-semibold text-blue-300 truncate">Rider heading to carrier hub</p>
                        <p className="text-[10px] text-stone-500 truncate">Carrier scans QR from rider</p>
                      </div>
                    </div>
                  ) : (
                    // Dropoff: locked until rider has taken custody
                    <div className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 h-12 cursor-default opacity-60">
                      <Building2 className="h-4 w-4 text-stone-600 shrink-0" />
                      <div className="text-left min-w-0">
                        <p className="text-xs font-semibold text-stone-500 truncate">Drop off at Carrier</p>
                        <p className="text-[10px] text-stone-600 truncate">Hand to rider first</p>
                      </div>
                    </div>
                  )
                ) : runBooking.status === "received" ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 h-12 cursor-default">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-xs font-semibold text-emerald-300 truncate">Received by carrier</p>
                      <p className="text-[10px] text-stone-500 truncate">{runBooking.carrierName ?? "Carrier"}</p>
                    </div>
                  </div>
                ) : runBooking.status === "dispatched" ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-3 h-12 cursor-default">
                    <Truck className="h-4 w-4 text-blue-400 shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-xs font-semibold text-blue-300 truncate">Dispatched by carrier</p>
                      <p className="text-[10px] text-stone-500 truncate">{runBooking.carrierName ?? "Carrier"}</p>
                    </div>
                  </div>
                ) : runBooking.status === "delivered" ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 h-12 cursor-default">
                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-xs font-semibold text-emerald-300 truncate">Delivered</p>
                      <p className="text-[10px] text-stone-500 truncate">{runBooking.carrierName ?? "Carrier"}</p>
                    </div>
                  </div>
                ) : runBooking.status === "expired" ? (
                  <button onClick={openDispatch} className="inline-flex items-center gap-2 rounded-lg border border-stone-700 bg-white/[0.03] hover:bg-white/[0.05] px-3 h-12">
                    <AlertCircle className="h-4 w-4 text-stone-500 shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-xs font-semibold truncate text-stone-400">Booking expired · Rebook</p>
                      <p className="text-[10px] text-stone-500 truncate">{runBooking.carrierName ?? "Carrier"}</p>
                    </div>
                  </button>
                ) : runBooking.status === "rejected" ? (
                  <button
                    onClick={openDispatch}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] text-red-300 h-12 px-3 hover:bg-red-500/[0.1] transition-all"
                  >
                    <XCircle className="h-4 w-4 shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-xs font-semibold truncate">Declined · Rebook</p>
                      <p className="text-[10px] text-stone-500 truncate">{runBooking.carrierName ?? "Carrier"}</p>
                    </div>
                  </button>
                ) : null}
              </div>

              {handoverError && (
                <p className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{handoverError}
                </p>
              )}
            </div>
          );
        })()}

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
                {availableWaybills.map((w) => {
                  const offRoute = Boolean(
                    (run.originCity && !w.pickupLocation.toLowerCase().includes(run.originCity.toLowerCase())) ||
                    (run.destCity   && !w.deliveryLocation.toLowerCase().includes(run.destCity.toLowerCase()))
                  );
                  return (
                    <div key={w.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${offRoute ? "border-amber-500/25 bg-amber-500/[0.05]" : "border-white/[0.06] bg-white/[0.03]"}`}>
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-semibold text-stone-200 truncate">{w.waybillNumber}</p>
                        <p className="text-[11px] text-stone-500 truncate">{w.goodsDescription} · {w.pickupLocation} to {w.deliveryLocation}</p>
                        {offRoute && (
                          <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
                            <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                            Delivers to {w.deliveryLocation} — run goes to {run.destCity}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (offRoute && !window.confirm(
                            `This waybill delivers to ${w.deliveryLocation}, but this run goes to ${run.destCity}.\n\nAdd anyway?`
                          )) return;
                          handleAddLeg(w.shipmentId!);
                        }}
                        disabled={addingId === w.shipmentId}
                        className="ml-3 shrink-0 inline-flex items-center gap-1 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 text-white px-2.5 h-7 text-xs font-medium hover:shadow-orange-500/20 hover:shadow-sm transition-all disabled:opacity-60">
                        {addingId === w.shipmentId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Add
                      </button>
                    </div>
                  );
                })}
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
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <StatusBadge status={leg.status as ShipmentStatus} />
                    <span className="flex items-center gap-1 text-[10px] text-stone-500">
                      <ShieldCheck className="h-3 w-3" />{leg.handoverCount} Handover{leg.handoverCount !== 1 ? "s" : ""}
                    </span>
                    {leg.shipmentValue > 0 && (
                      <span className="text-[10px] text-stone-500">{formatNaira(leg.shipmentValue)}</span>
                    )}
                    {(() => {
                      const legOffRoute =
                        (run.originCity && !leg.pickupLocation.toLowerCase().includes(run.originCity.toLowerCase())) ||
                        (run.destCity   && !leg.deliveryLocation.toLowerCase().includes(run.destCity.toLowerCase()));
                      return legOffRoute ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/[0.08] border border-amber-500/20 rounded px-1.5 py-0.5">
                          <AlertCircle className="h-2.5 w-2.5 shrink-0" /> Route mismatch
                        </span>
                      ) : null;
                    })()}
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

      {/* ── Carrier dispatch modal ─────────────────────────────────────────── */}
      {dispatchOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full sm:max-w-md rounded-t-xl sm:rounded-xl border border-white/[0.08] bg-[#0c1522] shadow-2xl shadow-black/40 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
              <div>
                <p className="text-sm font-semibold text-white">Dispatch to carrier</p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  {dispatchStep === "cities" ? "Enter the route cities to see carrier rates" :
                   dispatchStep === "rates"  ? `${originCity} → ${destCity} · choose a carrier` :
                   "Confirm carrier booking"}
                </p>
              </div>
              <button onClick={() => setDispatchOpen(false)} className="text-stone-600 hover:text-stone-300 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {dispatchStep === "cities" && (
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1.5">Origin city</label>
                  <CityAutocomplete
                    value={originCity}
                    onChange={setOriginCity}
                    placeholder="e.g. Lagos"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1.5">Destination city</label>
                  <CityAutocomplete
                    value={destCity}
                    onChange={setDestCity}
                    placeholder="e.g. Abuja"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                  />
                </div>
                {dispatchError && (
                  <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />{dispatchError}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setDispatchOpen(false)}
                    className="flex-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 h-9 text-xs font-medium text-stone-400 hover:text-white hover:bg-white/[0.06] transition-all">
                    Cancel
                  </button>
                  <button onClick={handleFetchRates} disabled={ratesLoading}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 h-9 text-xs font-semibold text-white disabled:opacity-60 transition-all">
                    {ratesLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Fetching rates…</> : "See carrier rates →"}
                  </button>
                </div>
              </div>
            )}

            {dispatchStep === "rates" && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] text-xs text-stone-500 shrink-0">
                  <span className="font-medium text-stone-300">{originCity}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium text-stone-300">{destCity}</span>
                  <span>· {run?.legs.length} waybill{(run?.legs.length ?? 0) !== 1 ? "s" : ""}</span>
                </div>
                <div className="p-4 space-y-2 overflow-y-auto flex-1">
                  {rates.length === 0 ? (
                    <div className="py-10 text-center space-y-1">
                      <p className="text-sm text-stone-500">No carriers available for this route.</p>
                      <button onClick={() => setDispatchStep("cities")} className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
                        Try different cities
                      </button>
                    </div>
                  ) : rates.map((r, i) => (
                    <button key={i} onClick={() => { setSelectedRate(r); setDispatchStep("confirm"); }}
                      className={`w-full text-left rounded-lg border p-3 transition-all ${
                        selectedRate?.carrierId === r.carrierId
                          ? "border-orange-500/40 bg-orange-500/[0.08]"
                          : "border-white/[0.06] bg-white/[0.03] hover:border-orange-500/20 hover:bg-white/[0.05]"
                      }`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-stone-200">{r.carrierName ?? r.serviceName}</p>
                        <p className="text-sm font-bold text-white">{formatNairaRaw(r.totalCharge.amount)}</p>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5 capitalize">
                        {r.pricingModel?.replace("_", " ")}
                        {r.transitDays != null && ` · ${r.transitDays}d transit`}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-white/[0.06] shrink-0">
                  <button onClick={() => setDispatchStep("cities")}
                    className="text-xs text-stone-500 hover:text-stone-300 transition-colors">← Change route</button>
                </div>
              </div>
            )}

            {dispatchStep === "confirm" && selectedRate && (
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Carrier</span>
                    <span className="font-medium text-stone-200">{selectedRate.carrierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Route</span>
                    <span className="font-medium text-stone-200">{originCity} → {destCity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Waybills</span>
                    <span className="font-medium text-stone-200">{run?.legs.length}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.06] pt-2">
                    <span className="text-stone-500">Rate</span>
                    <span className="font-bold text-white">{formatNairaRaw(selectedRate.totalCharge.amount)}</span>
                  </div>
                </div>
                <p className="text-[11px] text-stone-500">
                  Payment is deducted from your OLI Switch wallet when the carrier accepts. You'll receive a drop-off QR to show at their hub.
                </p>
                {dispatchError && (
                  <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />{dispatchError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setDispatchStep("rates")}
                    className="flex-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 h-9 text-xs font-medium text-stone-400 hover:text-white hover:bg-white/[0.06] transition-all">
                    Back
                  </button>
                  <button onClick={handleDispatchToCarrier} disabled={dispatchWorking}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 h-9 text-xs font-semibold text-white disabled:opacity-60 transition-all">
                    {dispatchWorking
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Booking…</>
                      : <><Globe className="h-3.5 w-3.5" />Send booking request</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pickup QR modal — dynamic, with countdown + polling ───────────── */}
      {pickupQrOpen && runBooking?.dropoffToken && (() => {
        const pickupUrl = `${window.location.origin}/dropoff/${runBooking.dropoffToken}`;
        const mins = Math.floor(pickupSecondsLeft / 60);
        const secs = pickupSecondsLeft % 60;
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full sm:max-w-sm rounded-t-xl sm:rounded-xl border border-white/[0.08] bg-[#0c1522] shadow-2xl shadow-black/40 overflow-hidden">
              <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.06]">
                <div>
                  <p className="text-sm font-semibold text-white">Pickup QR</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Carrier's rider scans this at your location · {runBooking.waybillIds?.length ?? 0} waybill{(runBooking.waybillIds?.length ?? 0) !== 1 ? "s" : ""}
                  </p>
                </div>
                <button onClick={() => setPickupQrOpen(false)} className="text-stone-600 hover:text-stone-300 mt-0.5 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 flex flex-col items-center gap-4">
                {pickupConfirmed ? (
                  <div className="flex flex-col items-center justify-center h-[220px] gap-3">
                    <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-300">Pickup confirmed!</p>
                    <p className="text-[11px] text-stone-500">Carrier has taken custody of the shipments.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-white/[0.08] p-3 bg-white">
                    <QRCodeSVG value={pickupUrl} size={200} />
                  </div>
                )}
                {!pickupConfirmed && (
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-500">Expires in</span>
                      <span className={`font-mono font-semibold ${pickupSecondsLeft < 60 ? "text-red-400" : "text-stone-300"}`}>
                        {mins}:{secs.toString().padStart(2, "0")}
                      </span>
                    </div>
                    <button
                      onClick={() => setPickupSecondsLeft(5 * 60)}
                      className="w-full inline-flex items-center justify-center rounded-lg border border-white/[0.06] h-8 text-xs text-stone-500 hover:text-stone-300 transition-colors"
                    >
                      Refresh timer
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-stone-600 text-center">
                  {pickupConfirmed
                    ? "Booking will update automatically."
                    : "Carrier's rider scans this QR to confirm custody and mark the booking received."}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Drop-off QR modal ──────────────────────────────────────────────── */}
      {dropoffQrOpen && runBooking?.dropoffToken && (() => {
        const dropoffUrl = `${window.location.origin}/dropoff/${runBooking.dropoffToken}`;
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full sm:max-w-sm rounded-t-xl sm:rounded-xl border border-white/[0.08] bg-[#0c1522] shadow-2xl shadow-black/40 overflow-hidden">
              <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.06]">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {runBooking.handoverMode === "pickup" ? "Pickup QR" : "Drop-off QR"}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {runBooking.handoverMode === "pickup"
                      ? `Carrier's rider scans this at your location · ${runBooking.waybillIds?.length ?? 0} waybill${(runBooking.waybillIds?.length ?? 0) !== 1 ? "s" : ""}`
                      : `Show at ${runBooking.carrierName ?? "carrier hub"} · ${runBooking.waybillIds?.length ?? 0} waybill${(runBooking.waybillIds?.length ?? 0) !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <button onClick={() => setDropoffQrOpen(false)} className="text-stone-600 hover:text-stone-300 mt-0.5 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 flex flex-col items-center gap-4">
                <div className="rounded-lg border border-white/[0.08] p-3 bg-white">
                  <QRCodeSVG value={dropoffUrl} size={200} />
                </div>
                <div className="w-full space-y-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(dropoffUrl)}
                    className="w-full inline-flex items-center justify-center rounded-lg border border-white/[0.06] h-9 text-xs text-stone-500 hover:text-stone-300 transition-colors"
                  >
                    Copy link
                  </button>
                  {runBooking.dropoffTokenExpiresAt && (
                    <p className="text-[11px] text-stone-600 text-center">
                      Valid until {new Date(runBooking.dropoffTokenExpiresAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
                <p className="text-[11px] text-stone-600 text-center">
                  The carrier scans this QR at their hub to confirm receipt of all shipments.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

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
