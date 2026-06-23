import { useEffect, useState } from "react";
import {
  FileText, CheckCircle2, Clock, ExternalLink, Search,
  ShieldCheck, Plus, Truck, Archive, RotateCcw, Loader2,
} from "lucide-react";
import { waybillApi, type OperatorWaybill } from "@/services/handover";
import AssignRunModal from "@/components/logistics/AssignRunModal";
import { QuickShipment } from "@/components/logistics/QuickShipment";

type Filter = "all" | "in_transit" | "delivered" | "archived";

interface PendingAssign {
  shipmentId: string;
  waybillNumber: string;
  pickupLocation: string;
  deliveryLocation: string;
}

export default function WaybillsPage() {
  const [waybills, setWaybills] = useState<OperatorWaybill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [pendingAssign, setPendingAssign] = useState<PendingAssign | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  async function reload() {
    const data = await waybillApi.list();
    setWaybills(data);
  }

  useEffect(() => { reload().finally(() => setLoading(false)); }, []);

  async function handleArchive(w: OperatorWaybill, unarchive = false) {
    if (!w.shipmentId) return;
    setArchivingId(w.shipmentId);
    try {
      await waybillApi.archive(w.shipmentId, unarchive);
      setWaybills((prev) =>
        prev.map((x) =>
          x.shipmentId === w.shipmentId
            ? { ...x, archivedAt: unarchive ? null : new Date().toISOString() }
            : x
        )
      );
    } finally {
      setArchivingId(null);
    }
  }

  const activeWaybills = waybills.filter((w) => !w.archivedAt);

  const filtered = waybills.filter((w) => {
    if (filter === "archived") return Boolean(w.archivedAt);
    if (w.archivedAt) return false;
    if (filter === "delivered" && !w.isDelivered) return false;
    if (filter === "in_transit" && w.isDelivered) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        w.waybillNumber.toLowerCase().includes(q) ||
        w.goodsDescription.toLowerCase().includes(q) ||
        w.senderName.toLowerCase().includes(q) ||
        w.receiverName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all:       activeWaybills.length,
    in_transit: activeWaybills.filter((w) => !w.isDelivered).length,
    delivered:  activeWaybills.filter((w) => w.isDelivered).length,
    archived:   waybills.filter((w) => Boolean(w.archivedAt)).length,
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all",        label: "All" },
    { key: "in_transit", label: "In transit" },
    { key: "delivered",  label: "Delivered" },
    { key: "archived",   label: "Archived" },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar: filters + search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 self-start">
          {FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={["rounded-lg px-3 h-7 text-xs font-medium transition-all",
                filter === key
                  ? "bg-white/[0.08] text-white shadow-sm shadow-black/20"
                  : "text-stone-500 hover:text-stone-300"].join(" ")}>
              {label}
              <span className="ml-1.5 text-[10px] text-stone-600">{counts[key]}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search waybills..."
            className="w-full sm:w-56 rounded-lg border border-white/[0.06] bg-white/[0.04] pl-8 pr-3 h-9 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
          />
        </div>
      </div>

      {/* Waybill list */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] py-16 text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <FileText className="h-5 w-5 text-stone-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-stone-300">
            {waybills.length === 0 ? "No waybills yet" : "No results"}
          </p>
          <p className="text-xs text-stone-600">
            {waybills.length === 0
              ? "Use Quick Shipment to claim a waybill or join a leg from another operator."
              : "Try a different search or filter."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-[1fr_1.4fr_1fr_7rem_4rem_7rem_6rem] gap-4 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            {["Waybill", "Route", "Cargo", "Run", "Handovers", "Status", ""].map((h) => (
              <p key={h} className="text-[11px] font-medium text-stone-600 uppercase tracking-wide">{h}</p>
            ))}
          </div>

          <div className="divide-y divide-white/[0.04]">
            {filtered.map((w) => {
              const isArchived = Boolean(w.archivedAt);
              return (
                <div
                  key={w.id}
                  className={`grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_1fr_7rem_4rem_7rem_6rem] gap-2 sm:gap-4 items-center px-4 py-3.5 transition-colors ${isArchived ? "opacity-50" : "hover:bg-white/[0.03]"}`}
                >
                  {/* Waybill number + date */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-mono font-semibold text-stone-200 truncate">{w.waybillNumber}</p>
                      <a href={`/track/${w.id}`} target="_blank" rel="noopener noreferrer"
                        className="text-stone-600 hover:text-orange-400 transition-colors shrink-0">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      {new Date(w.claimedAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>

                  {/* Route */}
                  <div className="min-w-0">
                    <p className="text-xs text-stone-300 truncate">{w.senderName} to {w.receiverName}</p>
                    <p className="text-[11px] text-stone-600 truncate mt-0.5">{w.pickupLocation} to {w.deliveryLocation}</p>
                  </div>

                  {/* Cargo */}
                  <p className="text-xs text-stone-300 truncate">{w.goodsDescription}</p>

                  {/* Run assignment */}
                  <div className="shrink-0">
                    {w.runId ? (
                      <a
                        href={`/dashboard/runs/${w.runId}`}
                        className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-stone-400 px-2 py-0.5 text-[11px] font-medium hover:bg-orange-500/[0.1] hover:border-orange-500/20 hover:text-orange-400 transition-all whitespace-nowrap"
                      >
                        <Truck className="h-2.5 w-2.5" />
                        {w.runName ? (w.runName.length > 14 ? w.runName.slice(0, 14) + "..." : w.runName) : "Run"}
                      </a>
                    ) : w.shipmentId && !isArchived ? (
                      <button
                        onClick={() => setPendingAssign({ shipmentId: w.shipmentId!, waybillNumber: w.waybillNumber, pickupLocation: w.pickupLocation, deliveryLocation: w.deliveryLocation })}
                        className="inline-flex items-center gap-1 rounded-full bg-orange-500/[0.1] border border-orange-500/20 text-orange-400 px-2 py-0.5 text-[11px] font-medium hover:bg-orange-500/[0.15] transition-all whitespace-nowrap"
                      >
                        <Plus className="h-2.5 w-2.5" /> Assign run
                      </button>
                    ) : (
                      <span className="text-[11px] text-stone-700">&mdash;</span>
                    )}
                  </div>

                  {/* Handover count */}
                  <div className="flex items-center gap-1.5 text-xs text-stone-500 shrink-0">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>{w.handoverCount}</span>
                  </div>

                  {/* Status */}
                  <div className="shrink-0">
                    {isArchived ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-500/[0.1] text-stone-500 border border-stone-500/20 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                        <Archive className="h-3 w-3" /> Archived
                      </span>
                    ) : w.isDelivered ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/[0.1] text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                        <CheckCircle2 className="h-3 w-3" /> Delivered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/[0.1] text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                        <Clock className="h-3 w-3" /> In transit
                      </span>
                    )}
                  </div>

                  {/* Archive / unarchive */}
                  <div className="shrink-0">
                    {w.shipmentId && (
                      <button
                        onClick={() => handleArchive(w, isArchived)}
                        disabled={archivingId === w.shipmentId}
                        title={isArchived ? "Restore" : "Archive"}
                        className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-stone-500 px-2 py-0.5 text-[11px] font-medium hover:bg-stone-500/[0.1] hover:border-stone-500/20 hover:text-stone-300 transition-all whitespace-nowrap disabled:opacity-40"
                      >
                        {archivingId === w.shipmentId
                          ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          : isArchived
                          ? <><RotateCcw className="h-2.5 w-2.5" /> Restore</>
                          : <><Archive className="h-2.5 w-2.5" /> Archive</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pendingAssign && (
        <AssignRunModal
          shipmentId={pendingAssign.shipmentId}
          waybillNumber={pendingAssign.waybillNumber}
          pickupLocation={pendingAssign.pickupLocation}
          deliveryLocation={pendingAssign.deliveryLocation}
          onClose={() => { setPendingAssign(null); reload(); }}
        />
      )}

      {/* Quick Shipment FAB — claim a waybill or join a leg */}
      <QuickShipment onDone={reload} />
    </div>
  );
}
