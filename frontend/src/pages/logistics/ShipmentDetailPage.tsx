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
        // Shipment not in local DB — try to recover it from OLI switch
        // (happens for waybills claimed before the local mirroring was added)
        try {
          await apiClient.post(`/api/waybill/recover/${id}`);
          s = await shipmentsApi.get(id); // retry after recovery
        } catch {
          return; // recovery failed — component stays with null shipment → "not found"
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

    // Fetch full cross-operator chain and sync local status if handovers happened
    if (s.waybillId) {
      publicWaybillApi.getChain(s.waybillId)
        .then(async (data: { chain: ChainEvent[] }) => {
          setWaybillChain(data.chain);
          // Only sync status if there are real handovers beyond the
          // initial claim event (ACTOR_SENDER → operator is synthetic)
          const realHandovers = data.chain.filter(
            (e) => e.giverActorType !== "ACTOR_SENDER"
          );
          if (
            realHandovers.length > 0 &&
            ["pending", "in_transit"].includes(s.status)
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

  if (loading) return <div className="animate-pulse h-64 rounded-lg bg-stone-100" />;
  if (!shipment) return <p className="text-sm text-muted-foreground">Shipment not found.</p>;

  const nextStatuses = NEXT_STATUSES[shipment.status as ShipmentStatus] || [];
  const showChain = waybillChain.length > 0;

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      {/* Header card */}
      <div className="rounded-lg border border-border bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-foreground">{shipment.goodsDescription}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {shipment.pickupLocation} → {shipment.deliveryLocation} · {formatDistance(shipment.distanceKm)}
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {liveConnected && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600">
                <Wifi className="h-3 w-3" /> Live
              </span>
            )}
            <RiskBadge score={shipment.riskScore} />
            <StatusBadge status={shipment.status as ShipmentStatus} />
          </div>
        </div>

        {/* Flags */}
        {(shipment.delayFlag || shipment.ghostingFlag) && (
          <div className="rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-700 font-medium">
            {shipment.ghostingFlag ? "⚠ Ghosting risk — no update in over 48 hours" : "⚠ Delayed — past expected delivery date"}
          </div>
        )}

        {/* Cost breakdown */}
        <div className="grid grid-cols-4 gap-3 pt-1">
          <div>
            <p className="text-[11px] text-muted-foreground">Fuel cost</p>
            <p className="text-sm font-semibold">{formatNaira(shipment.fuelCost)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Rider fee</p>
            <p className="text-sm font-semibold">{formatNaira(shipment.riderFee)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Logistics total</p>
            <p className="text-sm font-semibold">{formatNaira(shipment.totalCost)}</p>
          </div>
          {shipment.shipmentValue > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground">Goods value</p>
              <p className="text-sm font-semibold text-primary">{formatNaira(shipment.shipmentValue)}</p>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t border-border pt-3">
          <div><span className="font-medium text-foreground">Rider:</span> {shipment.riderName || "—"}</div>
          <div><span className="font-medium text-foreground">Expected:</span> {formatDate(shipment.expectedDeliveryDate)}</div>
          <div><span className="font-medium text-foreground">Created:</span> {formatDate(shipment.createdAt)}</div>
          {shipment.actualDeliveryDate && (
            <div><span className="font-medium text-foreground">Completed:</span> {formatDate(shipment.actualDeliveryDate)}</div>
          )}
          {shipment.recipientName && (
            <div><span className="font-medium text-foreground">Recipient:</span> {shipment.recipientName}</div>
          )}
          {shipment.recipientPhone && (
            <div><span className="font-medium text-foreground">Recipient phone:</span> {shipment.recipientPhone}</div>
          )}
          {shipment.notes && (
            <div className="col-span-2"><span className="font-medium text-foreground">Notes:</span> {shipment.notes}</div>
          )}
        </div>

        {shipment.riskScoreReasons?.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              Risk score breakdown — {shipment.riskScorePoints} pts
            </p>
            <ul className="space-y-1">
              {shipment.riskScoreReasons.map((reason: string, i: number) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Exposure panel */}
      {(["pending", "in_transit"].includes(shipment.status) && shipment.shipmentValue > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs font-semibold text-amber-800">Value at risk if this shipment ghosts</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-amber-700/70">Goods value</p>
              <p className="text-sm font-semibold text-amber-900">{formatNaira(shipment.shipmentValue)}</p>
            </div>
            <div>
              <p className="text-[11px] text-amber-700/70">Logistics spend</p>
              <p className="text-sm font-semibold text-amber-900">{formatNaira(shipment.totalCost)}</p>
            </div>
            <div>
              <p className="text-[11px] text-amber-700/70">Total exposure</p>
              <p className="text-base font-bold text-amber-900">{formatNaira(shipment.shipmentValue + shipment.totalCost)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loss summary for ghosted shipments */}
      {shipment.status === "ghosted" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Skull className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-xs font-semibold text-red-800">Loss from this ghosted shipment</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-red-700/70">Goods value</p>
              <p className="text-sm font-semibold text-red-900">{shipment.shipmentValue > 0 ? formatNaira(shipment.shipmentValue) : "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-red-700/70">Logistics wasted</p>
              <p className="text-sm font-semibold text-red-900">{formatNaira(shipment.totalCost)}</p>
            </div>
            <div>
              <p className="text-[11px] text-red-700/70">Total lost</p>
              <p className="text-base font-bold text-red-900">{formatNaira(shipment.shipmentValue + shipment.totalCost)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Dispute panel — shown for handed_over or ghosted */}
      {["handed_over", "ghosted"].includes(shipment.status) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-900">Dispute / Reclaim</p>
                <p className="text-[11px] text-red-700 mt-0.5">Open a dispute if custody was not properly transferred</p>
              </div>
            </div>
            {!showReclaimForm && (
              <button
                onClick={() => setShowReclaimForm(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 text-white px-3 h-8 text-xs font-medium hover:bg-red-700 transition-colors shrink-0"
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
                className="w-full rounded-md border border-red-300 bg-white px-3 h-8 text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReclaim}
                  disabled={updating}
                  className="inline-flex items-center gap-1.5 rounded-md bg-red-600 text-white px-3 h-8 text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                  Mark as disputed
                </button>
                <button onClick={() => setShowReclaimForm(false)} className="text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Initiate handover */}
      {HANDOVER_ELIGIBLE.includes(shipment.status as ShipmentStatus) && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-purple-900">Digital Handover</p>
              <p className="text-[11px] text-purple-700 mt-0.5">
                {shipment.status === "disputed"
                  ? "Re-initiate handover after dispute resolution"
                  : "Generate a QR code for the next person taking custody"}
              </p>
            </div>
            <button
              onClick={() => setShowHandoverModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-purple-700 text-white px-3 h-8 text-xs font-medium hover:bg-purple-800 transition-colors shrink-0"
            >
              <Handshake className="h-3.5 w-3.5" /> Handover
            </button>
          </div>
        </div>
      )}

      {/* Status update */}
      {nextStatuses.length > 0 && (
        <div className="rounded-lg border border-border bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-foreground mb-3">Update status</p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)"
            className="w-full rounded-md border border-input bg-white px-3 h-8 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-3"
          />
          <div className="flex gap-2 flex-wrap">
            {nextStatuses.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusUpdate(s)}
                disabled={updating}
                className={[
                  "inline-flex items-center gap-1.5 rounded-md px-3 h-8 text-xs font-medium transition-colors disabled:opacity-60",
                  s === "delivered"  ? "bg-green-600 text-white hover:bg-green-700" :
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
        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 flex items-center gap-2 text-xs font-medium text-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          Handover confirmed — custody chain updated in real time.
        </div>
      )}

      {/* Full waybill custody chain (cross-operator) */}
      {showChain && (
        <div className={[
          "rounded-lg border p-4 shadow-xs transition-colors duration-700",
          justUpdated ? "border-green-400 bg-green-50" : "border-purple-200 bg-white",
        ].join(" ")}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-foreground">Full custody chain</p>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-purple-500" />
              {waybillChain.length} event{waybillChain.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="relative">
            <div className="absolute left-[17px] top-5 bottom-5 w-px bg-purple-200" />
            <div className="space-y-3">
              {waybillChain.map((event, idx) => (
                <div key={event.id} className="relative flex gap-3">
                  <div className={[
                    "relative z-10 shrink-0 h-9 w-9 rounded-full border-2 flex items-center justify-center text-[10px] font-bold",
                    idx === waybillChain.length - 1 && event.receiverActorType === "ACTOR_RECEIVER"
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-purple-400 bg-purple-50 text-purple-700",
                  ].join(" ")}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 rounded-lg border border-border bg-stone-50 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{event.receiverName}</p>
                        <p className="text-[11px] text-muted-foreground">
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
                          className="shrink-0 text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5"
                        >
                          <MapPin className="h-2.5 w-2.5" /> GPS
                        </a>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[10px] text-muted-foreground truncate">
                        {event.proofHash.slice(0, 16)}…
                      </p>
                      <p className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
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

      {/* Fallback: shipment-scoped events when no waybill chain available */}
      {!showChain && handoverEvents.length > 0 && (
        <div className={[
          "rounded-lg border p-4 shadow-xs transition-colors duration-700",
          justUpdated ? "border-green-400 bg-green-50" : "border-purple-200 bg-white",
        ].join(" ")}>
          <p className="text-xs font-medium text-foreground mb-4">Custody events</p>
          <ol className="relative border-l border-purple-200 ml-2 space-y-4">
            {handoverEvents.map((event) => (
              <li key={event.id} className="ml-4">
                <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border border-white bg-purple-500" />
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {ACTOR_LABELS[event.giverActorType]} → {ACTOR_LABELS[event.receiverActorType]}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Received by {event.receiverName}</p>
                  <p className="font-mono text-[10px] text-muted-foreground mt-0.5">PoH: {event.proofHash.slice(0, 16)}…</p>
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(event.occurredAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Status timeline */}
      <div className="rounded-lg border border-border bg-white p-4 shadow-xs">
        <p className="text-xs font-medium text-foreground mb-4">Timeline</p>
        <ol className="relative border-l border-border ml-2 space-y-4">
          {log.map((entry) => (
            <li key={entry.id} className="ml-4">
              <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border border-white bg-primary" />
              <div>
                <p className="text-xs font-medium text-foreground capitalize">
                  {entry.newStatus.replace(/_/g, " ")}
                </p>
                {entry.note && <p className="text-[11px] text-muted-foreground">{entry.note}</p>}
                <p className="text-[11px] text-muted-foreground">{formatDateTime(entry.changedAt)}</p>
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
