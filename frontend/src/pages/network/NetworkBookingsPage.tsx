import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, ArrowRight, CheckCircle2, Clock, XCircle,
  AlertCircle, Globe, QrCode, Truck,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { runBookingApi, type RunBooking, type RunBookingStatus } from "@/services/carrier";

type Filter = "pending" | "accepted" | "all";

function fmt(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: RunBooking["status"] }) {
  const cfgs = {
    pending:    { label: "Awaiting acceptance", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20",    Icon: Clock },
    accepted:   { label: "Accepted",            cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",       Icon: CheckCircle2 },
    received:   { label: "Received",            cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", Icon: CheckCircle2 },
    dispatched: { label: "Dispatched",          cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",       Icon: CheckCircle2 },
    delivered:  { label: "Delivered",           cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", Icon: CheckCircle2 },
    expired:    { label: "Expired",             cls: "bg-stone-500/10 text-stone-400 border-stone-500/20",    Icon: XCircle },
    rejected:   { label: "Rejected",            cls: "bg-red-500/10 text-red-400 border-red-500/20",          Icon: XCircle },
  } satisfies Record<RunBookingStatus, { label: string; cls: string; Icon: typeof Clock }>;
  const { label, cls, Icon } = cfgs[status] ?? cfgs.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shrink-0 ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0c1522] border border-white/[0.08] rounded-2xl p-6 w-full max-w-xs space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-2">
          <QrCode className="h-4 w-4 text-stone-400" />
          <p className="text-sm font-semibold text-white">Drop-off QR</p>
        </div>
        <div className="bg-white rounded-xl p-4 inline-block mx-auto">
          <QRCodeSVG value={url} size={180} />
        </div>
        <p className="text-[11px] text-stone-500 leading-relaxed">
          Show this QR at the carrier's hub. Staff will scan it to confirm receipt and record the handover on OLI.
        </p>
        <button
          onClick={() => { navigator.clipboard.writeText(url); }}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] h-8 text-xs text-stone-300 hover:bg-white/[0.07] transition-colors"
        >
          Copy link
        </button>
        <button onClick={onClose}
          className="w-full rounded-lg bg-white/[0.08] h-8 text-xs text-white hover:bg-white/[0.12] transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}

export default function NetworkBookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<RunBooking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<Filter>("all");
  const [error, setError]       = useState<string | null>(null);
  const [qrUrl, setQrUrl]       = useState<string | null>(null);

  useEffect(() => {
    runBookingApi.listMine({ limit: 50 })
      .then(setBookings)
      .catch(() => setError("Could not load bookings. Check your OLI connection."))
      .finally(() => setLoading(false));
  }, []);

  const visible = bookings.filter((b) => {
    if (filter === "pending")  return b.status === "pending";
    if (filter === "accepted") return b.status === "accepted" || b.status === "received";
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-stone-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-400 p-4">
        <AlertCircle className="h-4 w-4 shrink-0" /> {error}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] pb-0">
        {(["all", "pending", "accepted"] as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              filter === f ? "border-orange-500 text-white" : "border-transparent text-stone-500 hover:text-stone-300"
            }`}>
            {f === "all" ? "All bookings" : f === "pending" ? "Pending" : "Active / Received"}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-stone-500 gap-2 text-center">
          <Globe className="h-8 w-8 opacity-30" />
          <p className="text-sm">No run bookings yet.</p>
          <p className="text-xs text-stone-600">
            Dispatch a run to a carrier from the{" "}
            <button onClick={() => navigate("/dashboard/network")} className="text-orange-400 hover:text-orange-300 underline">
              Carrier Directory
            </button>.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((b) => {
            const dropoffUrl = b.dropoffToken
              ? `${window.location.origin}/dropoff/${b.dropoffToken}`
              : null;
            const isAccepted = b.status === "accepted";

            return (
              <div key={b.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                {/* Top row */}
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
                      via <span className="text-stone-300">{b.carrierName ?? "carrier"}</span>
                    </p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>

                {/* Rate row */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 text-xs text-stone-500">
                    <span>
                      Rate: <span className="text-stone-300 font-medium">{fmt(b.quotedRateKobo)}</span>
                    </span>
                    <span>
                      Fee: <span className="text-stone-400">{fmt(b.bookingFeeKobo)}</span>
                    </span>
                  </div>

                  {isAccepted && dropoffUrl && (
                    <button
                      type="button"
                      onClick={() => setQrUrl(dropoffUrl)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 px-3 h-8 text-xs font-semibold text-white hover:shadow-lg hover:shadow-blue-500/20 transition-all"
                    >
                      <QrCode className="h-3.5 w-3.5" /> Show drop-off QR
                    </button>
                  )}

                  {b.status === "received" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Received by carrier
                    </span>
                  )}
                </div>

                {/* Source run link */}
                {b.sourceRunId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard/runs/${b.sourceRunId}`)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-stone-600 hover:text-stone-300 transition-colors"
                  >
                    <Truck className="h-3 w-3" /> View run
                  </button>
                )}

                {b.status === "rejected" && b.notes && (
                  <p className="text-xs text-red-400 bg-red-500/[0.06] rounded-lg px-3 py-2 border border-red-500/15">
                    Declined: {b.notes}
                  </p>
                )}

                {b.acceptedAt && b.status !== "rejected" && (
                  <p className="text-[11px] text-stone-600">
                    {b.status === "received" ? "Received" : "Accepted"}{" "}
                    {new Date(b.acceptedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {qrUrl && <QrModal url={qrUrl} onClose={() => setQrUrl(null)} />}
    </div>
  );
}
