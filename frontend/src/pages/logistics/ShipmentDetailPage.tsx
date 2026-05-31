import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, ShieldAlert, Skull, RefreshCw, Handshake, Wifi, AlertTriangle, MapPin, ShieldCheck } from "lucide-react";
import { shipmentsApi, type Shipment, type StatusLogEntry, type ShipmentStatus } from "@/services/logistics";
import { apiClient } from "@/lib/apiClient";
import { handoverApi, publicWaybillApi, ACTOR_LABELS, type HandoverEvent, type ActorType } from "@/services/handover";
import { formatNaira, formatDate, formatDateTime, formatDistance } from "@/lib/format";
import { StatusBadge, RiskBadge } from "@/components/logistics/StatusBadge";
import HandoverQRModal from "@/components/logistics/HandoverQRModal";
import { getApiBaseUrl } from "@/lib/runtimeConfig";
import { getAuthToken } from "@/lib/authToken";
import { triggerWalletRefresh } from "@/components/layout/WalletWidget";

const NEXT_STATUSES: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
  pending:     ["in_transit", "failed"],
  in_transit:  ["delivered", "ghosted", "failed"],
  handed_over: ["disputed"],
  ghosted:     ["in_transit", "disputed"],
  disputed:    ["in_transit"],
};

const HANDOVER_ELIGIBLE: ShipmentStatus[] = ["pending", "in_transit", "disputed"];

interface ChainEvent {
  id: string;
  giverName: string | null;
  giverActorType: ActorType;
  receiverName: string;
  receiverActorType: ActorType;
  proofHash: string;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
}

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [log, setLog] = useState<StatusLogEntry[]>([]);
  const [handoverEvents, setHandoverEvents] = useState<HandoverEvent[]>([]);
  const [waybillChain, setWaybillChain] = useState<ChainEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState("");
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [reclaimReason, setReclaimReason] = useState("");
  const [showReclaimForm, setShowReclaimForm] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  async function load() {
    if (!id) return;

    let s;
    try {
      s = await shipmentsApi.get(id);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        try {
          await apiClient.post(`/api/waybill/recover/${id}`);
          s = await shipmentsApi.get(id);
        } catch {
          return;
        }
      } else {
        return;
      }
    }

    const [l, events] = await Promise.all([
      shipmentsApi.getLog(id).catch(() => []),
      handoverApi.getEvents(id).catch(() => []),
    ]);
    setShipment(s);
    setLog(l as StatusLogEntry[]);
    setHandoverEvents(events);

    if (s.waybillId) {
      publicWaybillApi.getChain(s.waybillId)
        .then(async (data: { chain: ChainEvent[] }) => {
          setWaybillChain(data.chain);
          const realHandovers = data.chain.filter(
            (e) => e.giverActorType !== "ACTOR_SENDER"
          );
          if (
            realHandovers.length > 0 &&
            ["pending", "in_transit", "disputed"].includes(s.status)
          ) {
            try {
              const updated = await shipmentsApi.updateStatus(
                s.id,
                "handed_over" as ShipmentStatus,
                "Auto-synced from OLI custody chain"
              );
              setShipment(updated);
              const freshLog = await shipmentsApi.getLog(s.id);
              setLog(freshLog as StatusLogEntry[]);
            } catch {}
          }
        })
        .catch(() => {});
    }
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, [id]);

  useEffect(() => {
    if (!id) return;
    const base = getApiBaseUrl() ?? "";
    const token = getAuthToken();
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const es = new EventSource(`${base}/api/handover/stream/${id}${qs}`);
    esRef.current = es;

    es.addEventListener("open", () => setLiveConnected(true));
    es.addEventListener("error", () => setLiveConnected(false));
    es.addEventListener("message", () => {
      load().then(() => {
        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 4000);
      });
      triggerWalletRefresh();
    });

    return () => { es.close(); setLiveConnected(false); };
  }, [id]);

  async function handleStatusUpdate(status: ShipmentStatus) {
    if (!id) return;
    setUpdating(true);
    try {
      const updated = await shipmentsApi.updateStatus(id, status, note);
      setShipment(updated);
      const l = await shipmentsApi.getLog(id);
      setLog(l);
      setNote("");
    } finally {
      setUpdating(false);
    }
  }

  async function handleReclaim() {
    if (!id) return;
    setUpdating(true);
    try {
      const updated = await shipmentsApi.reclaim(id, reclaimReason || undefined);
      setShipment(updated);
      const l = await shipmentsApi.getLog(id);
      setLog(l);
      setReclaimReason("");
      setShowReclaimForm(false);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return <div className="animate-pulse h-64 rounded-lg bg-white/[0.03] border border-white/[0.06]" />;
  if (!shipment) return <p className="text-sm text-stone-500">Shipment not found.</p>;

  const nextStatuses = NEXT_STATUSES[shipment.status as ShipmentStatus] || [];
  const showChain = waybillChain.length > 0;

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      {/* Header card */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-white">{shipment.goodsDescription}</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {shipment.pickupLocation} → {shipment.deliveryLocation} · {formatDistance(shipment.distanceKm)}
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {liveConnected && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                <Wifi className="h-3 w-3" /> Live
              </span>
            )}
            <RiskBadge score={shipment.riskScore} />
            <StatusBadge status={shipment.status as ShipmentStatus} />
          </div>
        </div>

        {/* Flags */}
        {(shipment.delayFlag || shipment.ghostingFlag) && (
          <div className="rounded-lg bg-orange-500/[0.06] border border-orange-500/20 px-3 py-2 text-xs text-orange-400 font-medium">
            {shipment.ghostingFlag ? "⚠ Ghosting risk — no update in over 48 hours" : "⚠ Delayed — past expected delivery date"}
          </div>
        )}

        {/* Cost breakdown */}
        <div className="grid grid-cols-4 gap-3 pt-1">
          <div>
            <p className="text-[11px] text-stone-600">Fuel cost</p>
            <p className="text-sm font-semibold text-stone-200">{formatNaira(shipment.fuelCost)}</p>
          </div>
          <div>
            <p className="text-[11px] text-stone-600">Rider fee</p>
            <p className="text-sm font-semibold text-stone-200">{formatNaira(shipment.riderFee)}</p>
          </div>
          <div>
            <p className="text-[11px] text-stone-600">Logistics total</p>
            <p className="text-sm font-semibold text-stone-200">{formatNaira(shipment.totalCost)}</p>
          </div>
          {shipment.shipmentValue > 0 && (
            <div>
              <p className="text-[11px] text-stone-600">Goods value</p>
              <p className="text-sm font-semibold text-orange-400">{formatNaira(shipment.shipmentValue)}</p>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-2 text-xs text-stone-500 border-t border-white/[0.06] pt-3">
          <div><span className="font-medium text-stone-300">Rider:</span> {shipment.riderName || "—"}</div>
          <div><span className="font-medium text-stone-300">Expected:</span> {formatDate(shipment.expectedDeliveryDate)}</div>
          <div><span className="font-medium text-stone-300">Created:</span> {formatDate(shipment.createdAt)}</div>
          {shipment.actualDeliveryDate && (
            <div><span className="font-medium text-stone-300">Completed:</span> {formatDate(shipment.actualDeliveryDate)}</div>
          )}
          {shipment.recipientName && (
            <div><span className="font-medium text-stone-300">Recipient:</span> {shipment.recipientName}</div>
          )}
          {shipment.recipientPhone && (
            <div><span className="font-medium text-stone-300">Recipient phone:</span> {shipment.recipientPhone}</div>
          )}
          {shipment.notes && (
            <div className="col-span-2"><span className="font-medium text-stone-300">Notes:</span> {shipment.notes}</div>
          )}
        </div>

        {shipment.riskScoreReasons?.length > 0 && (
          <div className="border-t border-white/[0.06] pt-3">
            <p className="text-[11px] font-medium text-stone-500 mb-1.5 uppercase tracking-wide">
              Risk score breakdown — {shipment.riskScorePoints} pts
            </p>
            <ul className="space-y-1">
              {shipment.riskScoreReasons.map((reason: string, i: number) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px] text-stone-500">
                  <span className="h-1 w-1 rounded-full bg-stone-600 shrink-0" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Exposure panel */}
      {(["pending", "in_transit"].includes(shipment.status) && shipment.shipmentValue > 0) && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
            <p className="text-xs font-semibold text-amber-300">Value at risk if this shipment ghosts</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-amber-500/70">Goods value</p>
              <p className="text-sm font-semibold text-amber-300">{formatNaira(shipment.shipmentValue)}</p>
            </div>
            <div>
              <p className="text-[11px] text-amber-500/70">Logistics spend</p>
              <p className="text-sm font-semibold text-amber-300">{formatNaira(shipment.totalCost)}</p>
            </div>
            <div>
              <p className="text-[11px] text-amber-500/70">Total exposure</p>
              <p className="text-base font-bold text-amber-300">{formatNaira(shipment.shipmentValue + shipment.totalCost)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loss summary for ghosted shipments */}
      {shipment.status === "ghosted" && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Skull className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-xs font-semibold text-red-300">Loss from this ghosted shipment</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-red-500/70">Goods value</p>
              <p className="text-sm font-semibold text-red-300">{shipment.shipmentValue > 0 ? formatNaira(shipment.shipmentValue) : "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-red-500/70">Logistics wasted</p>
              <p className="text-sm font-semibold text-red-300">{formatNaira(shipment.totalCost)}</p>
            </div>
            <div>
              <p className="text-[11px] text-red-500/70">Total lost</p>
              <p className="text-base font-bold text-red-300">{formatNaira(shipment.shipmentValue + shipment.totalCost)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Dispute panel */}
      {["handed_over", "ghosted"].includes(shipment.status) && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-300">Dispute / Reclaim</p>
                <p className="text-[11px] text-red-400/70 mt-0.5">Open a dispute if custody was not properly transferred</p>
              </div>
            </div>
            {!showReclaimForm && (
              <button
                onClick={() => setShowReclaimForm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-3 h-8 text-xs font-medium hover:bg-red-700 transition-colors shrink-0"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Dispute
              </button>
            )}
          </div>
          {showReclaimForm && (
            <div className="mt-3 space-y-2">
              <input
                value={reclaimReason}
                onChange={(e) => setReclaimReason(e.target.value)}
                placeholder="Reason (e.g. driver unreachable, goods not delivered)"
                className="w-full rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 h-8 text-xs text-white placeholder:text-red-400/50 focus:outline-none focus:border-red-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReclaim}
                  disabled={updating}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-3 h-8 text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                  Mark as disputed
                </button>
                <button onClick={() => setShowReclaimForm(false)} className="text-xs text-stone-500 hover:text-stone-300 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Initiate handover */}
      {HANDOVER_ELIGIBLE.includes(shipment.status as ShipmentStatus) && (
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/[0.06] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-purple-300">Digital Handover</p>
              <p className="text-[11px] text-purple-400/70 mt-0.5">
                {shipment.status === "disputed"
                  ? "Re-initiate handover after dispute resolution"
                  : "Generate a QR code for the next person taking custody"}
              </p>
            </div>
            <button
              onClick={() => setShowHandoverModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 text-white px-3 h-8 text-xs font-medium hover:bg-purple-700 transition-colors shrink-0"
            >
              <Handshake className="h-3.5 w-3.5" /> Handover
            </button>
          </div>
        </div>
      )}

      {/* Status update */}
      {nextStatuses.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-xs font-medium text-stone-300 mb-3">Update status</p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-8 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors mb-3"
          />
          <div className="flex gap-2 flex-wrap">
            {nextStatuses.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusUpdate(s)}
                disabled={updating}
                className={[
                  "inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-medium transition-colors disabled:opacity-60",
                  s === "delivered"  ? "bg-emerald-600 text-white hover:bg-emerald-700" :
                  s === "ghosted"    ? "bg-orange-600 text-white hover:bg-orange-700" :
                  s === "disputed"   ? "bg-red-600 text-white hover:bg-red-700" :
                  s === "in_transit" ? "bg-teal-600 text-white hover:bg-teal-700" :
                                      "bg-red-600 text-white hover:bg-red-700",
                ].join(" ")}
              >
                {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {s === "in_transit" ? "Resume transit" : `Mark as ${s.replace(/_/g, " ")}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live update banner */}
      {justUpdated && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-2.5 flex items-center gap-2 text-xs font-medium text-emerald-400">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          Handover confirmed — custody chain updated in real time.
        </div>
      )}

      {/* Full waybill custody chain */}
      {showChain && (
        <div className={[
          "rounded-lg border p-4 transition-colors duration-700",
          justUpdated ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-purple-500/20 bg-white/[0.03]",
        ].join(" ")}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-stone-300">Full custody chain</p>
            <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
              <ShieldCheck className="h-3 w-3 text-purple-400" />
              {waybillChain.length} event{waybillChain.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="relative">
            <div className="absolute left-[17px] top-5 bottom-5 w-px bg-purple-500/20" />
            <div className="space-y-3">
              {waybillChain.map((event, idx) => (
                <div key={event.id} className="relative flex gap-3">
                  <div className={[
                    "relative z-10 shrink-0 h-9 w-9 rounded-full border-2 flex items-center justify-center text-[10px] font-bold",
                    idx === waybillChain.length - 1 && event.receiverActorType === "ACTOR_RECEIVER"
                      ? "border-emerald-500 bg-emerald-500/[0.15] text-emerald-400"
                      : "border-purple-400 bg-purple-500/[0.1] text-purple-400",
                  ].join(" ")}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.04] p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-stone-200 truncate">{event.receiverName}</p>
                        <p className="text-[11px] text-stone-500">
                          {event.giverName
                            ? `${event.giverName} (${ACTOR_LABELS[event.giverActorType]})`
                            : ACTOR_LABELS[event.giverActorType]}{" "}→ {ACTOR_LABELS[event.receiverActorType]}
                        </p>
                      </div>
                      {event.latitude != null && event.longitude != null && (
                        <a
                          href={`https://maps.google.com?q=${event.latitude},${event.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[10px] text-stone-500 hover:text-orange-400 flex items-center gap-0.5 transition-colors"
                        >
                          <MapPin className="h-2.5 w-2.5" /> GPS
                        </a>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[10px] text-stone-600 truncate">
                        {event.proofHash.slice(0, 16)}…
                      </p>
                      <p className="text-[10px] text-stone-600 shrink-0 whitespace-nowrap">
                        {new Date(event.occurredAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                        {" · "}
                        {new Date(event.occurredAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fallback: shipment-scoped events */}
      {!showChain && handoverEvents.length > 0 && (
        <div className={[
          "rounded-lg border p-4 transition-colors duration-700",
          justUpdated ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-purple-500/20 bg-white/[0.03]",
        ].join(" ")}>
          <p className="text-xs font-medium text-stone-300 mb-4">Custody events</p>
          <ol className="relative border-l border-purple-500/20 ml-2 space-y-4">
            {handoverEvents.map((event) => (
              <li key={event.id} className="ml-4">
                <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border border-[#060d18] bg-purple-500" />
                <div>
                  <p className="text-xs font-medium text-stone-200">
                    {ACTOR_LABELS[event.giverActorType]} → {ACTOR_LABELS[event.receiverActorType]}
                  </p>
                  <p className="text-[11px] text-stone-500">Received by {event.receiverName}</p>
                  <p className="font-mono text-[10px] text-stone-600 mt-0.5">PoH: {event.proofHash.slice(0, 16)}…</p>
                  <p className="text-[11px] text-stone-500">{formatDateTime(event.occurredAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Status timeline */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
        <p className="text-xs font-medium text-stone-300 mb-4">Timeline</p>
        <ol className="relative border-l border-white/[0.08] ml-2 space-y-4">
          {log.map((entry) => (
            <li key={entry.id} className="ml-4">
              <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border border-[#060d18] bg-orange-500" />
              <div>
                <p className="text-xs font-medium text-stone-200 capitalize">
                  {entry.newStatus.replace(/_/g, " ")}
                </p>
                {entry.note && <p className="text-[11px] text-stone-500">{entry.note}</p>}
                <p className="text-[11px] text-stone-600">{formatDateTime(entry.changedAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {showHandoverModal && shipment && (
        <HandoverQRModal
          shipmentId={shipment.id}
          goodsDescription={shipment.goodsDescription}
          onClose={() => setShowHandoverModal(false)}
          onConfirmed={() => {
            load().then(() => {
              setJustUpdated(true);
              setTimeout(() => setJustUpdated(false), 4000);
            });
          }}
        />
      )}
    </div>
  );
}
