import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, ShieldAlert, Skull, RefreshCw } from "lucide-react";
import { shipmentsApi, type Shipment, type StatusLogEntry, type ShipmentStatus } from "@/services/logistics";
import { formatNaira, formatDate, formatDateTime, formatDistance } from "@/lib/format";
import { StatusBadge, RiskBadge } from "@/components/logistics/StatusBadge";

const NEXT_STATUSES: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
  pending:    ["in_transit", "failed"],
  in_transit: ["delivered", "ghosted", "failed"],
  ghosted:    ["in_transit"],
};

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [log, setLog] = useState<StatusLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState("");

  async function load() {
    if (!id) return;
    const [s, l] = await Promise.all([shipmentsApi.get(id), shipmentsApi.getLog(id)]);
    setShipment(s);
    setLog(l);
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, [id]);

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

  if (loading) return <div className="animate-pulse h-64 rounded-lg bg-stone-100" />;
  if (!shipment) return <p className="text-sm text-muted-foreground">Shipment not found.</p>;

  const nextStatuses = NEXT_STATUSES[shipment.status as ShipmentStatus] || [];

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

        {/* Risk score breakdown */}
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
                  s === "delivered" ? "bg-green-600 text-white hover:bg-green-700" :
                  s === "ghosted"   ? "bg-orange-600 text-white hover:bg-orange-700" :
                  (s === "in_transit" && shipment.status === "ghosted") ? "bg-teal-600 text-white hover:bg-teal-700" :
                                      "bg-red-600 text-white hover:bg-red-700",
                ].join(" ")}
              >
                {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : (s === "in_transit" && shipment.status === "ghosted") ? <RefreshCw className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                {(s === "in_transit" && shipment.status === "ghosted") ? "Recover shipment" : `Mark as ${s.replace("_", " ")}`}
              </button>
            ))}
          </div>
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
                  {entry.newStatus.replace("_", " ")}
                </p>
                {entry.note && <p className="text-[11px] text-muted-foreground">{entry.note}</p>}
                <p className="text-[11px] text-muted-foreground">{formatDateTime(entry.changedAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
