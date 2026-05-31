import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Package, CheckSquare2, Square, X, Layers, QrCode, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { shipmentsApi, type Shipment, type ShipmentStatus } from "@/services/logistics";
import {
  handoverApi,
  type ActorType, type BulkHandoverInitiated,
} from "@/services/handover";
import { formatNaira, formatDate } from "@/lib/format";
import { StatusBadge, RiskBadge } from "@/components/logistics/StatusBadge";
import { QRCodeSVG } from "qrcode.react";

const FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "In Transit", value: "in_transit" },
  { label: "Delivered", value: "delivered" },
  { label: "Ghosted", value: "ghosted" },
  { label: "Failed", value: "failed" },
];

const BULK_ACTOR_OPTIONS: { value: ActorType; label: string; internal: boolean }[] = [
  { value: "ACTOR_COURIER", label: "Courier / Driver (external)",    internal: false },
  { value: "ACTOR_HUB",     label: "Partner Hub (external)",         internal: false },
  { value: "ACTOR_HUB",     label: "Warehouse Staff (internal)",     internal: true  },
  { value: "ACTOR_RECEIVER", label: "Direct to Receiver",            internal: false },
];

type BulkStep = "choose-receiver" | "qr" | "done";

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState<BulkStep>("choose-receiver");
  const [bulkActorIdx, setBulkActorIdx] = useState(0);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [batchResult, setBatchResult] = useState<BulkHandoverInitiated | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load(status?: string) {
    setLoading(true);
    shipmentsApi.list(status ? { status } : undefined)
      .then(setShipments)
      .finally(() => setLoading(false));
  }

  const hasSynced = useRef(false);
  useEffect(() => {
    if (!hasSynced.current) {
      hasSynced.current = true;
      shipmentsApi.syncHandoverStatus()
        .catch(() => {})
        .finally(() => load(filter || undefined));
    } else {
      load(filter || undefined);
    }
  }, [filter]);

  useEffect(() => {
    if (!selectMode) setSelected(new Set());
  }, [selectMode]);

  useEffect(() => {
    if (secondsLeft > 0) {
      timerRef.current = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [secondsLeft]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openBulkModal() {
    setBulkStep("choose-receiver");
    setBulkActorIdx(0);
    setBulkError("");
    setBatchResult(null);
    setBulkOpen(true);
  }

  function closeBulkModal() {
    setBulkOpen(false);
    if (bulkStep === "done") {
      setSelectMode(false);
      load(filter || undefined);
    }
  }

  async function handleInitiateBulk() {
    const opt = BULK_ACTOR_OPTIONS[bulkActorIdx];
    setBulkWorking(true);
    setBulkError("");
    try {
      const result = await handoverApi.initiateBulk({
        shipmentIds: Array.from(selected),
        receiverActorType: opt.value,
        giverActorType: "ACTOR_HUB",
        internal: opt.internal,
      });
      setBatchResult(result);
      const secs = Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000);
      setSecondsLeft(secs);
      setBulkStep("qr");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setBulkError(
        status === 402
          ? "Insufficient wallet balance. Please top up your OLI Switch wallet and try again."
          : msg || "Failed to initiate bulk handover."
      );
    } finally {
      setBulkWorking(false);
    }
  }

  const scanUrl = batchResult ? `${window.location.origin}/scan?token=${batchResult.token}` : null;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="max-w-5xl space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={[
                "rounded-lg px-3 h-7 text-xs font-medium transition-colors",
                filter === f.value
                  ? "bg-white/[0.12] text-white"
                  : "text-stone-500 hover:text-stone-300 hover:bg-white/[0.04]",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSelectMode((v) => !v)}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-3 h-7 text-xs font-medium transition-colors",
            selectMode
              ? "bg-orange-500/[0.15] text-orange-400 border border-orange-500/30"
              : "text-stone-500 hover:text-stone-300 hover:bg-white/[0.04]",
          ].join(" ")}
        >
          <CheckSquare2 className="h-3.5 w-3.5" />
          {selectMode ? "Cancel select" : "Select"}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-stone-500 animate-pulse">Loading…</div>
        ) : shipments.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-8 w-8 text-stone-600 mx-auto mb-3" />
            <p className="text-sm text-stone-500">No shipments yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {selectMode && <th className="px-3 py-2.5 w-8" />}
                  <th className="px-4 py-2.5 text-left font-medium text-stone-500">Shipment</th>
                  <th className="px-4 py-2.5 text-left font-medium text-stone-500 hidden sm:table-cell">Route</th>
                  <th className="px-4 py-2.5 text-left font-medium text-stone-500 hidden md:table-cell">Rider</th>
                  <th className="px-4 py-2.5 text-left font-medium text-stone-500">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium text-stone-500 hidden sm:table-cell">Cost</th>
                  <th className="px-4 py-2.5 text-left font-medium text-stone-500 hidden lg:table-cell">Expected</th>
                  <th className="px-4 py-2.5 text-left font-medium text-stone-500 hidden md:table-cell">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {shipments.map((s) => {
                  const isSelected = selected.has(s.id);
                  return (
                    <tr
                      key={s.id}
                      onClick={selectMode ? () => toggleSelect(s.id) : undefined}
                      className={[
                        "transition-colors",
                        selectMode ? "cursor-pointer" : "",
                        isSelected ? "bg-orange-500/[0.08]" : (s.delayFlag || s.ghostingFlag) ? "bg-orange-500/[0.04]" : "hover:bg-white/[0.03]",
                      ].join(" ")}
                    >
                      {selectMode && (
                        <td className="px-3 py-3">
                          {isSelected
                            ? <CheckSquare2 className="h-4 w-4 text-orange-400" />
                            : <Square className="h-4 w-4 text-stone-600" />}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Link
                          to={`/dashboard/shipments/${s.id}`}
                          onClick={(e) => selectMode && e.preventDefault()}
                          className="font-medium text-stone-200 hover:text-orange-400 truncate block max-w-[180px] transition-colors"
                        >
                          {s.goodsDescription}
                        </Link>
                        {(s.delayFlag || s.ghostingFlag) && (
                          <span className="text-[10px] text-orange-400 font-medium">
                            {s.ghostingFlag ? "⚠ Ghosting risk" : "⚠ Delayed"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-500 hidden sm:table-cell">
                        <span className="block truncate max-w-[160px]">{s.pickupLocation} → {s.deliveryLocation}</span>
                      </td>
                      <td className="px-4 py-3 text-stone-500 hidden md:table-cell">{s.riderName || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.status as ShipmentStatus} /></td>
                      <td className="px-4 py-3 text-right font-medium text-stone-200 hidden sm:table-cell">
                        {formatNaira(s.totalCost)}
                      </td>
                      <td className="px-4 py-3 text-stone-500 hidden lg:table-cell">{formatDate(s.expectedDeliveryDate)}</td>
                      <td className="px-4 py-3 hidden md:table-cell"><RiskBadge score={s.riskScore} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full bg-[#0c1522] border border-white/[0.08] px-5 h-12 shadow-xl text-white text-sm font-medium">
          <span>{selected.size} selected</span>
          <div className="w-px h-5 bg-white/[0.1]" />
          <button
            onClick={openBulkModal}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-400 hover:text-orange-300 transition-colors"
          >
            <Layers className="h-4 w-4" /> Bulk hand over
          </button>
          <button onClick={() => setSelected(new Set())} className="text-stone-500 hover:text-stone-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Bulk handover modal */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full sm:max-w-sm rounded-t-xl sm:rounded-xl border border-white/[0.08] bg-[#0c1522] shadow-2xl shadow-black/40 overflow-hidden">
            <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <p className="text-sm font-semibold text-white">Bulk handover</p>
                <p className="text-[11px] text-stone-500 mt-0.5">{selected.size} shipment{selected.size !== 1 ? "s" : ""} selected</p>
              </div>
              <button onClick={closeBulkModal} className="text-stone-600 hover:text-stone-300 mt-0.5 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {bulkStep === "choose-receiver" && (
                <>
                  <p className="text-xs text-stone-500">Who are you handing these shipments to?</p>
                  <div className="space-y-2">
                    {BULK_ACTOR_OPTIONS.map((opt, idx) => (
                      <button
                        key={`${opt.value}-${opt.internal}`}
                        onClick={() => setBulkActorIdx(idx)}
                        className={[
                          "w-full rounded-lg border px-3 py-2.5 text-left text-xs transition-all",
                          bulkActorIdx === idx
                            ? "border-orange-500/40 bg-orange-500/[0.08] text-orange-400 font-medium"
                            : "border-white/[0.06] text-stone-500 hover:border-white/[0.12] hover:text-stone-300",
                        ].join(" ")}
                      >
                        {opt.label}
                        {opt.internal && (
                          <span className="ml-2 text-[10px] text-emerald-400 bg-emerald-500/[0.1] border border-emerald-500/20 rounded px-1">flat fee only</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {bulkError && (
                    <p className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />{bulkError}
                    </p>
                  )}
                  <button
                    onClick={handleInitiateBulk}
                    disabled={bulkWorking}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 text-white h-9 text-xs font-semibold hover:shadow-orange-500/20 hover:shadow-lg transition-all disabled:opacity-60"
                  >
                    {bulkWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                    Generate batch QR
                  </button>
                </>
              )}

              {bulkStep === "qr" && scanUrl && (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-xs text-stone-500 text-center">
                    Ask the receiver to scan this code to confirm receipt of all {batchResult?.shipmentCount} shipments.
                  </p>
                  <div className="rounded-lg border border-white/[0.08] p-3 bg-white">
                    <QRCodeSVG value={scanUrl} size={180} />
                  </div>
                  {secondsLeft > 0 ? (
                    <p className="text-xs font-medium text-amber-400">
                      Expires in {mins}:{String(secs).padStart(2, "0")}
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-red-400">Expired — generate a new code</p>
                  )}
                  <button
                    onClick={async () => { await navigator.clipboard.writeText(scanUrl); }}
                    disabled={secondsLeft === 0}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.06] h-8 text-xs text-stone-500 hover:text-stone-300 disabled:opacity-40 transition-colors"
                  >
                    Copy link
                  </button>
                  {secondsLeft === 0 && (
                    <button
                      onClick={() => { setBulkStep("choose-receiver"); setBatchResult(null); }}
                      className="w-full inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 text-white h-8 text-xs font-semibold"
                    >
                      Regenerate
                    </button>
                  )}
                  <button
                    onClick={() => setBulkStep("done")}
                    className="text-xs text-stone-500 underline underline-offset-2 hover:text-stone-300 transition-colors"
                  >
                    Receiver confirmed in person
                  </button>
                </div>
              )}

              {bulkStep === "done" && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/[0.15] flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">Batch handover complete</p>
                  <button
                    onClick={closeBulkModal}
                    className="rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 text-white h-9 px-4 text-xs font-medium"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
