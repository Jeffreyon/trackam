import { useEffect, useState } from "react";
import {
  Loader2, ArrowRight, CheckCircle2, Clock, XCircle, AlertCircle,
  Globe, QrCode, Truck, Building2, Package,
} from "lucide-react";
import { runBookingApi, type RunBooking, type HandoverMode } from "@/services/carrier";
import JoinLegModal from "@/components/logistics/JoinLegModal";

type Filter = "pending" | "accepted" | "all";

function fmt(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

const MODE_CFG: Record<HandoverMode, { label: string; sub: string; Icon: typeof Truck; color: string; border: string; bg: string }> = {
  pickup:  { label: "We'll pick up",        sub: "Carrier's rider collects from sender",   Icon: Truck,     color: "text-blue-400",    border: "border-blue-500/20",    bg: "bg-blue-500/[0.07]" },
  dropoff: { label: "Sender drops off here", sub: "Sender's rider delivers to our hub",    Icon: Building2, color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/[0.07]" },
};

export default function IncomingBookingsPage() {
  const [bookings, setBookings]       = useState<RunBooking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<Filter>("pending");
  const [acting, setActing]           = useState<string | null>(null);
  const [rejectId, setRejectId]       = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [error, setError]             = useState<string | null>(null);

  // Accept flow: which booking is in "pick a mode" state
  const [acceptingId, setAcceptingId]     = useState<string | null>(null);
  const [selectedMode, setSelectedMode]   = useState<HandoverMode | null>(null);

  // Receive flow: which booking opens the join-leg scan modal
  const [receiveBookingId, setReceiveBookingId] = useState<string | null>(null);

  useEffect(() => {
    const status = filter === "all" ? undefined : (filter as "pending" | "accepted");
    setLoading(true);
    runBookingApi.listIncoming({ status: status as never, limit: 50 })
      .then(setBookings)
      .catch(() => setError("Could not load incoming bookings."))
      .finally(() => setLoading(false));
  }, [filter]);

  function startAccept(bookingId: string) {
    setAcceptingId(bookingId);
    setSelectedMode(null);
  }

  async function confirmAccept() {
    if (!acceptingId || !selectedMode) return;
    setActing(acceptingId);
    try {
      const updated = await runBookingApi.accept(acceptingId, selectedMode);
      setBookings((prev) => prev.map((b) => b.id === acceptingId ? updated : b));
      setAcceptingId(null);
      setSelectedMode(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || "Failed to accept booking.");
    } finally {
      setActing(null);
    }
  }

  async function handleReceiveJoined(bookingId: string) {
    try {
      await runBookingApi.receive(bookingId);
      setBookings((prev) => prev.map((b) => b.id === bookingId
        ? { ...b, status: "received" as const, receivedAt: new Date().toISOString() }
        : b
      ));
    } catch {
      // join leg already succeeded; status sync is best-effort
    }
    setReceiveBookingId(null);
  }

  async function handleReject() {
    if (!rejectId) return;
    setActing(rejectId);
    try {
      const updated = await runBookingApi.reject(rejectId, rejectNotes || undefined);
      setBookings((prev) => prev.map((b) => b.id === rejectId ? updated : b));
      setRejectId(null);
      setRejectNotes("");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || "Failed to decline booking.");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] pb-0">
        {(["pending", "accepted", "all"] as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              filter === f ? "border-orange-500 text-white" : "border-transparent text-stone-500 hover:text-stone-300"
            }`}>
            {f === "all" ? "All" : f === "accepted" ? "Active" : "Pending"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-red-400 p-4">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-stone-500 gap-2 text-center">
          <Globe className="h-8 w-8 opacity-30" />
          <p className="text-sm">No {filter === "all" ? "" : filter + " "}run bookings.</p>
          {filter === "pending" && (
            <p className="text-xs text-stone-600">When operators dispatch runs to your carrier, they'll appear here.</p>
          )}
        </div>
      ) : (
        bookings.map((b) => {
          const isPending     = b.status === "pending";
          const isAccepted    = b.status === "accepted";
          const isActing      = acting === b.id;
          const isPickingMode = acceptingId === b.id;
          const modeCfg = b.handoverMode ? MODE_CFG[b.handoverMode] : null;

          return (
            <div key={b.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm mb-1">
                    <span className="font-semibold text-white">{b.originCity}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-stone-600 shrink-0" />
                    <span className="font-semibold text-white">{b.destCity}</span>
                  </div>
                  <p className="text-xs text-stone-500">
                    <span className="text-stone-400 font-medium">{b.waybillCount ?? 0}</span> waybill{(b.waybillCount ?? 0) !== 1 ? "s" : ""}
                    <span className="mx-1.5 text-stone-700">·</span>
                    from <span className="text-stone-300">{b.bookerName ?? "an operator"}</span>
                  </p>
                </div>

                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shrink-0 ${
                  b.status === "pending"    ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                  b.status === "accepted"   ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                  b.status === "received"   ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                  b.status === "dispatched" ? "bg-blue-500/10 text-blue-300 border-blue-500/20" :
                  b.status === "delivered"  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" :
                  "bg-red-500/10 text-red-400 border-red-500/20"
                }`}>
                  {b.status === "pending"                                    && <Clock className="h-3 w-3" />}
                  {(b.status === "accepted" || b.status === "received")      && <CheckCircle2 className="h-3 w-3" />}
                  {b.status === "dispatched"                                 && <Truck className="h-3 w-3" />}
                  {b.status === "delivered"                                  && <CheckCircle2 className="h-3 w-3" />}
                  {(b.status === "rejected" || b.status === "expired")       && <XCircle className="h-3 w-3" />}
                  {b.status === "pending"    ? "Pending" :
                   b.status === "accepted"   ? "Accepted" :
                   b.status === "received"   ? "Received" :
                   b.status === "dispatched" ? "Dispatched" :
                   b.status === "delivered"  ? "Delivered" :
                   b.status === "expired"    ? "Expired" : "Rejected"}
                </span>
              </div>

              {/* Handover mode badge (once accepted) */}
              {isAccepted && modeCfg && (
                <div className={`flex items-center gap-2 rounded-lg border ${modeCfg.border} ${modeCfg.bg} px-3 py-2`}>
                  <modeCfg.Icon className={`h-3.5 w-3.5 shrink-0 ${modeCfg.color}`} />
                  <div>
                    <p className={`text-xs font-semibold ${modeCfg.color}`}>{modeCfg.label}</p>
                    <p className="text-[11px] text-stone-500">{modeCfg.sub}</p>
                  </div>
                </div>
              )}

              {/* Rate */}
              <div className="text-xs text-stone-500">
                Rate: <span className="text-stone-300 font-medium">{fmt(b.quotedRateKobo)}</span>
                <span className="mx-2 text-stone-700">·</span>
                You receive: <span className="text-emerald-400 font-medium">{fmt(b.quotedRateKobo - b.bookingFeeKobo)}</span>
              </div>

              {/* Mode picker (inline, shown when carrier clicks Accept) */}
              {isPending && isPickingMode && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] text-stone-500 font-medium">How will you receive these shipments?</p>
                  {(Object.entries(MODE_CFG) as [HandoverMode, typeof MODE_CFG[HandoverMode]][]).map(([mode, cfg]) => (
                    <button key={mode} type="button" onClick={() => setSelectedMode(mode)}
                      className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                        selectedMode === mode
                          ? `${cfg.border} ${cfg.bg}`
                          : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.1]"
                      }`}>
                      <cfg.Icon className={`h-4 w-4 shrink-0 ${selectedMode === mode ? cfg.color : "text-stone-600"}`} />
                      <div>
                        <p className={`text-xs font-semibold ${selectedMode === mode ? cfg.color : "text-stone-300"}`}>{cfg.label}</p>
                        <p className="text-[11px] text-stone-500">{cfg.sub}</p>
                      </div>
                      {selectedMode === mode && <CheckCircle2 className={`h-3.5 w-3.5 ml-auto shrink-0 ${cfg.color}`} />}
                    </button>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setAcceptingId(null); setSelectedMode(null); }}
                      className="flex-none rounded-lg border border-white/10 bg-white/[0.04] px-3 h-8 text-xs text-stone-400 hover:text-white hover:bg-white/[0.07] transition-all">
                      Cancel
                    </button>
                    <button type="button" onClick={confirmAccept} disabled={!selectedMode || isActing}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 h-8 text-xs font-semibold text-white disabled:opacity-50 transition-all">
                      {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      Confirm acceptance
                    </button>
                  </div>
                </div>
              )}

              {/* Actions row */}
              {!isPickingMode && (
                <div className="flex items-center justify-end gap-2">
                  {isAccepted && (
                    <button type="button" onClick={() => setReceiveBookingId(b.id)}
                      disabled={isActing}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-3 h-8 text-xs font-medium text-emerald-300 hover:bg-emerald-500/[0.12] disabled:opacity-60 transition-all">
                      <Package className="h-3 w-3" /> Receive shipments
                    </button>
                  )}

                  {isPending && (
                    <>
                      <button type="button"
                        onClick={() => { setRejectId(b.id); setRejectNotes(""); }}
                        disabled={isActing}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 h-8 text-xs font-medium text-stone-300 hover:bg-white/[0.07] disabled:opacity-60 transition-all">
                        <XCircle className="h-3 w-3" /> Decline
                      </button>
                      <button type="button"
                        onClick={() => startAccept(b.id)}
                        disabled={isActing}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-3 h-8 text-xs font-semibold text-white disabled:opacity-60 transition-all">
                        <CheckCircle2 className="h-3 w-3" /> Accept
                      </button>
                    </>
                  )}
                </div>
              )}

              {b.acceptedAt && !isPickingMode && (
                <p className="text-[11px] text-stone-600">
                  Accepted {new Date(b.acceptedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          );
        })
      )}

      {/* Join-leg scan modal — carrier hub receives incoming shipments */}
      {receiveBookingId && (
        <JoinLegModal
          onClose={() => setReceiveBookingId(null)}
          onJoined={() => handleReceiveJoined(receiveBookingId)}
        />
      )}

      {/* Decline modal */}
      {rejectId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-sm font-semibold text-white">Decline run booking</h3>
            <p className="text-xs text-stone-500">Optionally add a note for the sender.</p>
            <textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Reason for declining (optional)" rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-stone-600 resize-none focus:outline-none focus:border-white/20"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setRejectId(null)}
                className="px-4 h-8 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-stone-300 hover:bg-white/[0.07]">
                Cancel
              </button>
              <button type="button" onClick={handleReject} disabled={acting === rejectId}
                className="px-4 h-8 rounded-lg bg-red-500/80 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60">
                {acting === rejectId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
