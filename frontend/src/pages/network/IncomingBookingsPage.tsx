import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Package, MapPin, ArrowRight, CheckCircle2, Clock, XCircle, AlertCircle, ExternalLink, Globe, QrCode } from "lucide-react";
import { networkBookingApi, runBookingApi, type NetworkBooking, type NetworkBookingStatus, type RunBooking } from "@/services/carrier";
import { shipmentsApi } from "@/services/logistics";

const STATUS_CFG: Record<NetworkBookingStatus, { label: string; cls: string; icon: typeof Clock }> = {
  pending:  { label: "Pending",  cls: "bg-amber-500/10 text-amber-400 border-amber-500/20",  icon: Clock },
  accepted: { label: "Accepted", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",     icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-red-500/10 text-red-400 border-red-500/20",        icon: XCircle },
  expired:  { label: "Expired",  cls: "bg-stone-500/10 text-stone-400 border-stone-500/20",  icon: XCircle },
};

function fmt(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

type Filter    = "pending" | "accepted" | "all";
type SectionTab = "waybill" | "run";

export default function IncomingBookingsPage() {
  const navigate = useNavigate();
  const [section, setSection]         = useState<SectionTab>("waybill");

  // Waybill bookings
  const [bookings, setBookings]       = useState<NetworkBooking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<Filter>("pending");
  const [acting, setActing]           = useState<string | null>(null);
  const [rejectId, setRejectId]       = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [error, setError]             = useState<string | null>(null);
  // waybillId → local shipmentId for accepted bookings that have been physically received
  const [shipmentMap, setShipmentMap] = useState<Map<string, string>>(new Map());

  // Run bookings
  const [runBookings, setRunBookings]     = useState<RunBooking[]>([]);
  const [runLoading, setRunLoading]       = useState(false);
  const [runFilter, setRunFilter]         = useState<Filter>("pending");
  const [runActing, setRunActing]         = useState<string | null>(null);
  const [runRejectId, setRunRejectId]     = useState<string | null>(null);
  const [runRejectNotes, setRunRejectNotes] = useState("");
  const [runError, setRunError]           = useState<string | null>(null);

  useEffect(() => {
    const status = filter === "all" ? undefined : filter;
    setLoading(true);
    Promise.all([
      networkBookingApi.listIncoming({ status, limit: 50 }),
      shipmentsApi.list(),
    ])
      .then(([bkgs, shipments]) => {
        setBookings(bkgs);
        const map = new Map<string, string>();
        for (const s of shipments) {
          if (s.waybillId) map.set(s.waybillId, s.id);
        }
        setShipmentMap(map);
      })
      .catch(() => setError("Could not load incoming bookings."))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    if (section !== "run") return;
    const status = runFilter === "all" ? undefined : (runFilter as "pending" | "accepted");
    setRunLoading(true);
    runBookingApi.listIncoming({ status: status as never, limit: 50 })
      .then(setRunBookings)
      .catch(() => setRunError("Could not load incoming run bookings."))
      .finally(() => setRunLoading(false));
  }, [section, runFilter]);

  async function handleRunAccept(bookingId: string) {
    setRunActing(bookingId);
    try {
      const updated = await runBookingApi.accept(bookingId);
      setRunBookings((prev) => prev.map((b) => b.id === bookingId ? updated : b));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || "Failed to accept run booking.");
    } finally {
      setRunActing(null);
    }
  }

  async function handleRunReject() {
    if (!runRejectId) return;
    setRunActing(runRejectId);
    try {
      const updated = await runBookingApi.reject(runRejectId, runRejectNotes || undefined);
      setRunBookings((prev) => prev.map((b) => b.id === runRejectId ? updated : b));
      setRunRejectId(null);
      setRunRejectNotes("");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || "Failed to reject run booking.");
    } finally {
      setRunActing(null);
    }
  }

  async function handleAccept(bookingId: string) {
    setActing(bookingId);
    try {
      const updated = await networkBookingApi.accept(bookingId);
      setBookings(prev => prev.map(b => b.id === bookingId ? updated : b));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || "Failed to accept booking.");
    } finally {
      setActing(null);
    }
  }

  async function handleReject() {
    if (!rejectId) return;
    setActing(rejectId);
    try {
      const updated = await networkBookingApi.reject(rejectId, rejectNotes || undefined);
      setBookings(prev => prev.map(b => b.id === rejectId ? updated : b));
      setRejectId(null);
      setRejectNotes("");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || "Failed to reject booking.");
    } finally {
      setActing(null);
    }
  }

  const visible = bookings.filter(b => {
    if (filter === "pending") return b.status === "pending";
    if (filter === "accepted") return b.status === "accepted";
    return true;
  });

  const visibleRunBookings = runBookings.filter((b) => {
    if (runFilter === "pending")  return b.status === "pending";
    if (runFilter === "accepted") return b.status === "accepted";
    return true;
  });

  return (
    <div className="max-w-3xl space-y-4">
      {/* Section tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] pb-0">
        <button type="button" onClick={() => setSection("waybill")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${section === "waybill" ? "border-orange-500 text-white" : "border-transparent text-stone-500 hover:text-stone-300"}`}>
          <Package className="h-3 w-3" /> Waybill Bookings
        </button>
        <button type="button" onClick={() => setSection("run")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${section === "run" ? "border-orange-500 text-white" : "border-transparent text-stone-500 hover:text-stone-300"}`}>
          <Globe className="h-3 w-3" /> Run Bookings
        </button>
      </div>

      {/* ── Waybill bookings section ── */}
      {section === "waybill" && (<>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] pb-0">
        {(["pending", "accepted", "all"] as Filter[]).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-2 text-xs font-medium capitalize border-b-2 -mb-px transition-colors ${
              filter === f
                ? "border-orange-500 text-white"
                : "border-transparent text-stone-500 hover:text-stone-300"
            }`}
          >
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
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-stone-500 gap-2">
          <Package className="h-8 w-8 opacity-30" />
          <p className="text-sm">No {filter === "all" ? "" : filter + " "}bookings.</p>
          {filter === "pending" && (
            <p className="text-xs text-stone-600">When other operators book your carrier services, they'll appear here.</p>
          )}
        </div>
      ) : (
        visible.map(b => {
          const cfg = STATUS_CFG[b.status] ?? STATUS_CFG.pending;
          const Icon = cfg.icon;
          const isPending = b.status === "pending";
          const isActing = acting === b.id;

          const linkedShipmentId = b.waybillId ? shipmentMap.get(b.waybillId) : undefined;

          return (
            <div key={b.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-stone-500 mb-0.5">{b.waybillNumber ?? b.waybillId}</p>
                  <p className="text-sm font-medium text-white truncate">{b.goodsDescription ?? "Shipment"}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    from <span className="text-stone-300">{b.bookerName ?? "an operator"}</span>
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shrink-0 ${cfg.cls}`}>
                  <Icon className="h-3 w-3" /> {cfg.label}
                </span>
              </div>

              {(b.pickupLocation || b.deliveryLocation) && (
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <MapPin className="h-3 w-3 shrink-0 text-stone-600" />
                  <span className="truncate">{b.pickupLocation}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-stone-600" />
                  <span className="truncate">{b.deliveryLocation}</span>
                </div>
              )}

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4 text-xs text-stone-500">
                  <span>Rate: <span className="text-stone-300 font-medium">{fmt(b.quotedRateKobo)}</span></span>
                  <span>You receive: <span className="text-emerald-400 font-medium">{fmt(b.quotedRateKobo - b.bookingFeeKobo)}</span></span>
                </div>

                <div className="flex items-center gap-2">
                  {linkedShipmentId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/shipments/${linkedShipmentId}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 h-8 text-xs font-medium text-stone-300 hover:bg-white/[0.07] transition-all"
                    >
                      <ExternalLink className="h-3 w-3" /> View Shipment
                    </button>
                  )}

                  {isPending && (
                    <>
                      <button
                        type="button"
                        onClick={() => { setRejectId(b.id); setRejectNotes(""); }}
                        disabled={isActing}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 h-8 text-xs font-medium text-stone-300 hover:bg-white/[0.07] disabled:opacity-60 transition-all"
                      >
                        {isActing && rejectId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAccept(b.id)}
                        disabled={isActing}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-3 h-8 text-xs font-semibold text-white disabled:opacity-60 transition-all"
                      >
                        {isActing && rejectId !== b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Accept
                      </button>
                    </>
                  )}
                </div>
              </div>

              {b.acceptedAt && (
                <p className="text-[11px] text-stone-600">
                  Accepted {new Date(b.acceptedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          );
        })
      )}

      {/* Reject modal (waybill bookings) */}
      {rejectId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-sm font-semibold text-white">Decline booking</h3>
            <p className="text-xs text-stone-500">Optionally add a note for the sender.</p>
            <textarea
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              placeholder="Reason for declining (optional)"
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-stone-600 resize-none focus:outline-none focus:border-white/20"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setRejectId(null)}
                className="px-4 h-8 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-stone-300 hover:bg-white/[0.07]">
                Cancel
              </button>
              <button type="button" onClick={handleReject} disabled={acting === rejectId}
                className="px-4 h-8 rounded-lg bg-red-500/80 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60">
                {acting === rejectId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Decline booking"}
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}

      {/* ── Run bookings section ── */}
      {section === "run" && (<>
        <div className="flex items-center gap-1 border-b border-white/[0.06] pb-0">
          {(["pending", "accepted", "all"] as Filter[]).map(f => (
            <button key={f} type="button" onClick={() => setRunFilter(f)}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                runFilter === f ? "border-orange-500 text-white" : "border-transparent text-stone-500 hover:text-stone-300"
              }`}>
              {f === "all" ? "All" : f === "accepted" ? "Active" : "Pending"}
            </button>
          ))}
        </div>

        {runLoading ? (
          <div className="flex items-center justify-center h-48 text-stone-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : runError ? (
          <div className="flex items-center gap-2 text-sm text-red-400 p-4">
            <AlertCircle className="h-4 w-4 shrink-0" /> {runError}
          </div>
        ) : visibleRunBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-stone-500 gap-2">
            <Globe className="h-8 w-8 opacity-30" />
            <p className="text-sm">No {runFilter === "all" ? "" : runFilter + " "}run bookings.</p>
            {runFilter === "pending" && (
              <p className="text-xs text-stone-600">When operators dispatch runs to your carrier, they'll appear here.</p>
            )}
          </div>
        ) : visibleRunBookings.map((b) => {
          const isPending  = b.status === "pending";
          const isAccepted = b.status === "accepted";
          const isActing   = runActing === b.id;
          const dropoffUrl = b.dropoffToken ? `${window.location.origin}/dropoff/${b.dropoffToken}` : null;

          return (
            <div key={b.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-stone-400 mb-1">
                    <span className="font-medium text-stone-300">{b.originCity}</span>
                    <ArrowRight className="h-3 w-3 text-stone-600" />
                    <span className="font-medium text-stone-300">{b.destCity}</span>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {(b.waybillCount ?? 0)} waybill{(b.waybillCount ?? 0) !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    from <span className="text-stone-300">{b.bookerName ?? "an operator"}</span>
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shrink-0 ${
                  b.status === "pending"  ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                  b.status === "accepted" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                  b.status === "received" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                  "bg-red-500/10 text-red-400 border-red-500/20"
                }`}>
                  {b.status === "pending"  && <Clock className="h-3 w-3" />}
                  {b.status === "accepted" && <CheckCircle2 className="h-3 w-3" />}
                  {b.status === "received" && <CheckCircle2 className="h-3 w-3" />}
                  {b.status === "rejected" && <XCircle className="h-3 w-3" />}
                  {b.status === "pending"  ? "Pending" :
                   b.status === "accepted" ? "Accepted" :
                   b.status === "received" ? "Received" : "Rejected"}
                </span>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-stone-500">
                  Rate: <span className="text-stone-300 font-medium">
                    ₦{(b.quotedRateKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="mx-2 text-stone-700">·</span>
                  You receive: <span className="text-emerald-400 font-medium">
                    ₦{((b.quotedRateKobo - b.bookingFeeKobo) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isAccepted && dropoffUrl && (
                    <button type="button" onClick={() => navigator.clipboard.writeText(dropoffUrl)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/[0.08] px-3 h-8 text-xs font-medium text-blue-300 hover:bg-blue-500/[0.12] transition-all">
                      <QrCode className="h-3 w-3" /> Copy drop-off link
                    </button>
                  )}
                  {isPending && (
                    <>
                      <button type="button" onClick={() => { setRunRejectId(b.id); setRunRejectNotes(""); }}
                        disabled={isActing}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 h-8 text-xs font-medium text-stone-300 hover:bg-white/[0.07] disabled:opacity-60 transition-all">
                        {isActing && runRejectId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                        Decline
                      </button>
                      <button type="button" onClick={() => handleRunAccept(b.id)} disabled={isActing}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-3 h-8 text-xs font-semibold text-white disabled:opacity-60 transition-all">
                        {isActing && runRejectId !== b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Accept
                      </button>
                    </>
                  )}
                </div>
              </div>

              {b.acceptedAt && (
                <p className="text-[11px] text-stone-600">
                  Accepted {new Date(b.acceptedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          );
        })}

        {/* Reject modal (run bookings) */}
        {runRejectId != null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
              <h3 className="text-sm font-semibold text-white">Decline run booking</h3>
              <p className="text-xs text-stone-500">Optionally add a note for the sender.</p>
              <textarea value={runRejectNotes} onChange={e => setRunRejectNotes(e.target.value)}
                placeholder="Reason for declining (optional)" rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-stone-600 resize-none focus:outline-none focus:border-white/20"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setRunRejectId(null)}
                  className="px-4 h-8 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-stone-300 hover:bg-white/[0.07]">
                  Cancel
                </button>
                <button type="button" onClick={handleRunReject} disabled={runActing === runRejectId}
                  className="px-4 h-8 rounded-lg bg-red-500/80 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60">
                  {runActing === runRejectId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Decline"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}
