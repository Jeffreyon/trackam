import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { shipmentsApi, type Shipment, type ShipmentStatus } from "@/services/logistics";
import { formatNaira, formatDate } from "@/lib/format";
import { StatusBadge, RiskBadge } from "@/components/logistics/StatusBadge";

const FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "In Transit", value: "in_transit" },
  { label: "Delivered", value: "delivered" },
  { label: "Ghosted", value: "ghosted" },
  { label: "Failed", value: "failed" },
];

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  function load(status?: string) {
    setLoading(true);
    shipmentsApi.list(status ? { status } : undefined)
      .then(setShipments)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(filter || undefined); }, [filter]);

  return (
    <div className="max-w-5xl space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={[
              "rounded-md px-3 h-7 text-xs font-medium transition-colors",
              filter === f.value
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading…</div>
        ) : shipments.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-8 w-8 text-stone-300 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No shipments yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Use Quick Dispatch to log your first one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Shipment</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Route</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Rider</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground hidden sm:table-cell">Cost</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Expected</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shipments.map((s) => (
                  <tr key={s.id} className={["hover:bg-secondary/30 transition-colors", (s.delayFlag || s.ghostingFlag) ? "bg-orange-50/50" : ""].join(" ")}>
                    <td className="px-4 py-3">
                      <Link to={`/dashboard/shipments/${s.id}`} className="font-medium text-foreground hover:text-primary truncate block max-w-[180px]">
                        {s.goodsDescription}
                      </Link>
                      {(s.delayFlag || s.ghostingFlag) && (
                        <span className="text-[10px] text-orange-600 font-medium">
                          {s.ghostingFlag ? "⚠ Ghosting risk" : "⚠ Delayed"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      <span className="block truncate max-w-[160px]">{s.pickupLocation} → {s.deliveryLocation}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{s.riderName || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status as ShipmentStatus} /></td>
                    <td className="px-4 py-3 text-right font-medium text-foreground hidden sm:table-cell">
                      {formatNaira(s.totalCost)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{formatDate(s.expectedDeliveryDate)}</td>
                    <td className="px-4 py-3 hidden md:table-cell"><RiskBadge score={s.riskScore} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
