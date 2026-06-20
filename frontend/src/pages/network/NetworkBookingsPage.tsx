import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Package, MapPin, ArrowRight, CheckCircle2, Clock, XCircle, Truck, AlertCircle } from "lucide-react";
import { networkBookingApi, type NetworkBooking, type NetworkBookingStatus } from "@/services/carrier";
import { shipmentsApi } from "@/services/logistics";

const STATUS_CFG: Record<NetworkBookingStatus, { label: string; cls: string; icon: typeof Clock }> = {
  pending:  { label: "Awaiting acceptance",  cls: "bg-amber-500/10 text-amber-400 border-amber-500/20",  icon: Clock },
  accepted: { label: "Accepted — hand over", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",     icon: CheckCircle2 },
  rejected: { label: "Rejected",             cls: "bg-red-500/10 text-red-400 border-red-500/20",        icon: XCircle },
  expired:  { label: "Expired",              cls: "bg-stone-500/10 text-stone-400 border-stone-500/20",  icon: XCircle },
};

function fmt(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

export default function NetworkBookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<NetworkBooking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [handingOver, setHandingOver] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    networkBookingApi.listMine({ limit: 50 })
      .then(setBookings)
      .catch(() => setError("Could not load bookings."))
      .finally(() => setLoading(false));
  }, []);

  async function handleHandOver(booking: NetworkBooking) {
    if (!booking.waybillId) return;
    setHandingOver(booking.id);
    try {
      const shipments = await shipmentsApi.list();
      const shipment = shipments.find(s => s.waybillId === booking.waybillId);
      if (shipment) {
        navigate(`/dashboard/shipments/${shipment.id}`);
      } else {
        navigate("/dashboard/shipments");
      }
    } finally {
      setHandingOver(null);
    }
  }

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

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-stone-500 gap-2">
        <Package className="h-8 w-8 opacity-30" />
        <p className="text-sm">No network bookings yet.</p>
        <p className="text-xs text-stone-600">Book a carrier from the Carrier Directory when you have a waybill ready.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-3">
      {bookings.map(b => {
        const cfg = STATUS_CFG[b.status] ?? STATUS_CFG.pending;
        const Icon = cfg.icon;
        const canHandOver = b.status === "accepted";

        return (
          <div key={b.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs font-mono text-stone-500 mb-0.5">{b.waybillNumber ?? b.waybillId}</p>
                <p className="text-sm font-medium text-white truncate">{b.goodsDescription ?? "Shipment"}</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  via <span className="text-stone-300">{b.carrierName ?? b.carrierType}</span>
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
                <span>Fee: <span className="text-stone-300">{fmt(b.bookingFeeKobo)}</span></span>
              </div>

              {canHandOver && (
                <button
                  type="button"
                  onClick={() => handleHandOver(b)}
                  disabled={handingOver === b.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-3 h-8 text-xs font-semibold text-white disabled:opacity-60 transition-all"
                >
                  {handingOver === b.id
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Loading…</>
                    : <><Truck className="h-3 w-3" /> Hand over to carrier</>}
                </button>
              )}
            </div>

            {b.status === "rejected" && b.notes != null && (
              <p className="text-xs text-red-400 bg-red-500/[0.06] rounded-lg px-3 py-2 border border-red-500/15">
                Rejection note: {b.notes}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
