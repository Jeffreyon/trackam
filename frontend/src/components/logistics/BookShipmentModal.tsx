import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Loader2, ArrowRight, ArrowLeft, CheckCircle2,
  Package, Truck, Zap, ChevronRight, AlertCircle,
} from "lucide-react";
import { waybillApi, type OperatorWaybill } from "@/services/handover";
import { networkRateApi, networkBookingApi, type NetworkRate, type NetworkBooking } from "@/services/carrier";

type Step = "waybill" | "route" | "rates" | "confirm" | "done";

interface Props {
  onClose: () => void;
  initialWaybill?: OperatorWaybill;
  initialCarrierId?: string; // pre-select a Trackam carrier
}

const CAPACITY_LABELS: Record<string, string> = {
  motorcycle: "Motorcycle",
  van:        "Van",
  truck:      "Truck",
  fleet:      "Fleet",
};

const CAPACITY_COLORS: Record<string, string> = {
  motorcycle: "text-orange-400 bg-orange-500/10 ring-orange-500/20",
  van:        "text-sky-400 bg-sky-500/10 ring-sky-500/20",
  truck:      "text-violet-400 bg-violet-500/10 ring-violet-500/20",
  fleet:      "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20",
};

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

function LogoOrAvatar({ logoUrl, name, size = 10 }: { logoUrl?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const cls = `h-${size} w-${size} rounded-lg flex-shrink-0`;
  if (logoUrl && !err) {
    return <img src={logoUrl} alt={name} onError={() => setErr(true)} className={`${cls} object-cover ring-1 ring-white/10`} />;
  }
  return (
    <div className={`${cls} bg-gradient-to-br from-orange-500/20 to-orange-700/10 ring-1 ring-orange-500/20 flex items-center justify-center`}>
      <span className="text-[10px] font-bold text-orange-300">{initials(name)}</span>
    </div>
  );
}

function RateRow({
  rate,
  selected,
  onSelect,
}: {
  rate: NetworkRate;
  selected: boolean;
  onSelect: () => void;
}) {
  const isTrackam    = rate.carrier === "trackam";
  const capCls       = CAPACITY_COLORS[rate.capacityType ?? ""] ?? "text-stone-400 bg-white/5 ring-white/10";
  const amountKobo   = Math.round(rate.totalCharge.amount * 100);
  const amountDisplay = rate.totalCharge.currency === "NGN"
    ? `₦${(rate.totalCharge.amount).toLocaleString("en-NG")}`
    : `${rate.totalCharge.currency} ${rate.totalCharge.amount.toLocaleString()}`;

  return (
    <button
      onClick={onSelect}
      className={[
        "w-full text-left flex items-center gap-3 rounded-lg p-3 border transition-all",
        selected
          ? "border-orange-500/50 bg-orange-500/[0.07]"
          : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.1] hover:bg-white/[0.05]",
      ].join(" ")}
    >
      {isTrackam ? (
        <LogoOrAvatar logoUrl={rate.logoUrl} name={rate.carrierName ?? rate.serviceName} size={10} />
      ) : (
        <div className="h-10 w-10 rounded-lg bg-yellow-500/10 ring-1 ring-yellow-500/20 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-yellow-400" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-white truncate">{isTrackam ? rate.carrierName : rate.serviceName}</p>
          {isTrackam && rate.capacityType && (
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ${capCls}`}>
              {CAPACITY_LABELS[rate.capacityType] ?? rate.capacityType}
            </span>
          )}
          {!isTrackam && (
            <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20">
              {rate.carrier.replace("_", " ").toUpperCase()}
            </span>
          )}
        </div>
        <p className="text-[11px] text-stone-500 mt-0.5 truncate">
          {isTrackam
            ? (rate.country?.toUpperCase() ?? "")
            : rate.serviceName}
          {rate.transitDays ? ` · ${rate.transitDays} days` : ""}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-white">{amountDisplay}</p>
        {isTrackam && amountKobo > 0 && (
          <p className="text-[10px] text-stone-600 mt-0.5">+ 5% fee</p>
        )}
      </div>

      {selected ? (
        <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 text-stone-700 shrink-0" />
      )}
    </button>
  );
}

export default function BookShipmentModal({ onClose, initialWaybill, initialCarrierId }: Props) {
  const [step, setStep]           = useState<Step>(initialWaybill ? "route" : "waybill");
  const [waybills, setWaybills]   = useState<OperatorWaybill[]>([]);
  const [waybill, setWaybill]     = useState<OperatorWaybill | null>(initialWaybill ?? null);
  const [originCity, setOriginCity]   = useState("");
  const [destCity, setDestCity]       = useState("");
  const [countryCode, setCountryCode] = useState("NG");
  const [weightKg, setWeightKg]   = useState("");
  const [rates, setRates]         = useState<NetworkRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [ratesError, setRatesError]     = useState("");
  const [selected, setSelected]   = useState<NetworkRate | null>(null);
  const [booking, setBooking]     = useState<NetworkBooking | null>(null);
  const [booking_loading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError]     = useState("");

  // Pre-fill cities from waybill when waybill is selected
  useEffect(() => {
    if (!waybill) return;
    const origin = waybill.pickupLocation.split(",").pop()?.trim() ?? waybill.pickupLocation;
    const dest   = waybill.deliveryLocation.split(",").pop()?.trim() ?? waybill.deliveryLocation;
    setOriginCity(origin);
    setDestCity(dest);
    if (waybill.estimatedWeightKg) setWeightKg(String(waybill.estimatedWeightKg));
  }, [waybill]);

  // Load waybills for the picker step
  useEffect(() => {
    if (step === "waybill") {
      waybillApi.list().then(setWaybills).catch(() => {});
    }
  }, [step]);

  // Pre-select carrier if initialCarrierId provided after rates load
  useEffect(() => {
    if (initialCarrierId && rates.length > 0) {
      const match = rates.find(r => r.carrier === "trackam" && r.carrierId === initialCarrierId);
      if (match) setSelected(match);
    }
  }, [initialCarrierId, rates]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function fetchRates() {
    if (!originCity.trim() || !destCity.trim()) return;
    setLoadingRates(true);
    setRatesError("");
    setRates([]);
    try {
      const pkg = {
        weight: { value: weightKg ? parseFloat(weightKg) : 1, unit: "kg" as const },
        ...(waybill?.dimensionsCm
          ? { dimensions: { ...waybill.dimensionsCm, unit: "cm" as const } }
          : {}),
      };
      const result = await networkRateApi.check({
        origin:      { countryCode, cityName: originCity.trim() },
        destination: { countryCode, cityName: destCity.trim() },
        packages:    [pkg],
        currency:    "NGN",
      });
      setRates(result);
      if (result.length === 0) setRatesError("No carriers found for this route. Try different cities or check back later.");
      setStep("rates");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Could not fetch rates. Check your OLI connection.";
      setRatesError(msg);
      setStep("rates");
    } finally {
      setLoadingRates(false);
    }
  }

  async function confirmBooking() {
    if (!selected || !waybill) return;
    setBookingLoading(true);
    setBookingError("");
    try {
      let result: NetworkBooking;
      if (selected.carrier === "trackam") {
        result = await networkBookingApi.book({
          carrier:          "trackam",
          carrierId:        selected.carrierId,
          waybillId:        waybill.id,
          quotedRateKobo:   Math.round(selected.totalCharge.amount * 100),
        });
      } else {
        // Integrated carriers need structured address — not yet supported from this modal
        setBookingError("DHL booking requires structured shipper/recipient addresses. Use the DHL booking form instead.");
        return;
      }
      setBooking(result);
      setStep("done");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
        ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Booking failed. Please try again.";
      setBookingError(msg);
    } finally {
      setBookingLoading(false);
    }
  }

  const trackamRates   = rates.filter(r => r.carrier === "trackam");
  const integratedRates = rates.filter(r => r.carrier !== "trackam");

  const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/40 focus:outline-none transition-colors";

  const panel = (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Book a carrier"
        className="relative w-full max-w-lg rounded-xl bg-[#0c1522] shadow-2xl shadow-black/50 border border-white/[0.08] overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            {step !== "waybill" && step !== "done" && (
              <button
                onClick={() => {
                  if (step === "route")   setStep(initialWaybill ? "route" : "waybill");
                  if (step === "rates")   setStep("route");
                  if (step === "confirm") { setSelected(null); setStep("rates"); }
                }}
                className="h-7 w-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-stone-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="h-8 w-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Truck className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">
                {step === "waybill"  && "Select waybill"}
                {step === "route"    && "Check carrier rates"}
                {step === "rates"    && "Choose a carrier"}
                {step === "confirm"  && "Confirm booking"}
                {step === "done"     && "Booking submitted"}
              </p>
              {waybill && step !== "waybill" && (
                <p className="text-[11px] text-stone-500 font-mono">{waybill.waybillNumber}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-stone-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* ── WAYBILL PICKER ── */}
          {step === "waybill" && (
            <div className="space-y-2">
              <p className="text-xs text-stone-500">Select the waybill you want to book a carrier for:</p>
              {waybills.length === 0 ? (
                <div className="py-10 text-center text-sm text-stone-600">Loading waybills…</div>
              ) : (
                waybills.filter(w => !w.isDelivered).map((w) => (
                  <button
                    key={w.id}
                    onClick={() => { setWaybill(w); setStep("route"); }}
                    className="w-full text-left rounded-lg border border-white/[0.06] bg-white/[0.03] hover:border-white/[0.1] hover:bg-white/[0.05] px-4 py-3 transition-all flex items-center gap-3"
                  >
                    <Package className="h-4 w-4 text-stone-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono font-semibold text-stone-200">{w.waybillNumber}</p>
                      <p className="text-[11px] text-stone-500 truncate mt-0.5">{w.pickupLocation} → {w.deliveryLocation}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-stone-700 shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}

          {/* ── ROUTE STEP ── */}
          {step === "route" && waybill && (
            <div className="space-y-4">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 space-y-0.5">
                <p className="text-xs text-stone-400 font-medium">{waybill.goodsDescription}</p>
                <p className="text-[11px] text-stone-600">{waybill.senderName} → {waybill.receiverName}</p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <div>
                    <label className="text-[11px] text-stone-500 font-medium block mb-1">Pickup city</label>
                    <input className={inputCls} value={originCity} onChange={e => setOriginCity(e.target.value)} placeholder="e.g. Lagos" />
                  </div>
                  <div>
                    <label className="text-[11px] text-stone-500 font-medium block mb-1">Country</label>
                    <input className={inputCls} value={countryCode} onChange={e => setCountryCode(e.target.value.toUpperCase().slice(0, 2))} placeholder="NG" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-stone-500 font-medium block mb-1">Delivery city</label>
                  <input className={inputCls} value={destCity} onChange={e => setDestCity(e.target.value)} placeholder="e.g. Abuja" />
                </div>
                <div>
                  <label className="text-[11px] text-stone-500 font-medium block mb-1">
                    Weight (kg) <span className="text-stone-700 font-normal">— optional, improves DHL quotes</span>
                  </label>
                  <input className={inputCls} value={weightKg} onChange={e => setWeightKg(e.target.value)} inputMode="decimal" placeholder="e.g. 5" />
                </div>
              </div>

              {ratesError && step === "route" && (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{ratesError}</p>
                </div>
              )}
            </div>
          )}

          {/* ── RATES STEP ── */}
          {step === "rates" && (
            <div className="space-y-3">
              {loadingRates ? (
                <div className="py-12 flex flex-col items-center gap-3 text-stone-500">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
                  <p className="text-sm">Checking carriers…</p>
                </div>
              ) : ratesError && rates.length === 0 ? (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{ratesError}</p>
                </div>
              ) : (
                <>
                  {trackamRates.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-stone-600 uppercase tracking-wider">Trackam network</p>
                      {trackamRates.map(r => (
                        <RateRow
                          key={r.serviceCode}
                          rate={r}
                          selected={selected?.serviceCode === r.serviceCode}
                          onSelect={() => { setSelected(r); setStep("confirm"); }}
                        />
                      ))}
                    </div>
                  )}

                  {integratedRates.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-stone-600 uppercase tracking-wider">Integrated carriers</p>
                      {integratedRates.map(r => (
                        <RateRow
                          key={r.serviceCode}
                          rate={r}
                          selected={selected?.serviceCode === r.serviceCode}
                          onSelect={() => { setSelected(r); setStep("confirm"); }}
                        />
                      ))}
                    </div>
                  )}

                  {rates.length > 0 && (
                    <p className="text-[11px] text-stone-700 text-center pt-1">
                      {originCity} → {destCity} · {rates.length} option{rates.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── CONFIRM STEP ── */}
          {step === "confirm" && selected && waybill && (
            <div className="space-y-4">
              {/* Carrier summary */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 flex items-center gap-3">
                {selected.carrier === "trackam" ? (
                  <LogoOrAvatar logoUrl={selected.logoUrl} name={selected.carrierName ?? ""} size={10} />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-yellow-500/10 ring-1 ring-yellow-500/20 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-yellow-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selected.carrier === "trackam" ? selected.carrierName : selected.serviceName}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    {selected.carrier === "trackam"
                      ? `Trackam carrier · ${CAPACITY_LABELS[selected.capacityType ?? ""] ?? selected.capacityType}`
                      : selected.carrier.replace("_", " ").toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Route + cargo */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">Waybill</span>
                  <span className="font-mono text-stone-300">{waybill.waybillNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Route</span>
                  <span className="text-stone-300">{originCity} → {destCity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Cargo</span>
                  <span className="text-stone-300 text-right max-w-[60%]">{waybill.goodsDescription}{waybill.estimatedWeightKg ? ` · ${waybill.estimatedWeightKg}kg` : ""}</span>
                </div>
              </div>

              {/* Rate breakdown */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-2">
                <p className="text-[10px] font-semibold text-stone-600 uppercase tracking-wider mb-3">Rate breakdown</p>
                {selected.carrier === "trackam" ? (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-500">Carrier rate</span>
                      <span className="text-stone-300">
                        {selected.totalCharge.currency === "NGN" ? "₦" : selected.totalCharge.currency + " "}
                        {selected.totalCharge.amount.toLocaleString("en-NG")}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-500">Platform fee (5%)</span>
                      <span className="text-stone-500">deducted from carrier</span>
                    </div>
                    <div className="border-t border-white/[0.06] pt-2 flex justify-between text-sm font-semibold">
                      <span className="text-white">You pay</span>
                      <span className="text-orange-400">
                        ₦{selected.totalCharge.amount.toLocaleString("en-NG")}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-500">Carrier rate</span>
                      <span className="text-stone-300">
                        {selected.totalCharge.currency} {selected.totalCharge.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-500">Platform fee (5%)</span>
                      <span className="text-stone-300">
                        {selected.totalCharge.currency} {(selected.totalCharge.amount * 0.05).toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t border-white/[0.06] pt-2 flex justify-between text-sm font-semibold">
                      <span className="text-white">You pay</span>
                      <span className="text-orange-400">
                        {selected.totalCharge.currency} {(selected.totalCharge.amount * 1.05).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Context note */}
              <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-stone-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  {selected.carrier === "trackam"
                    ? "Funds are held in escrow until the physical handover is confirmed. The carrier has 30 minutes to accept."
                    : "Your OLI wallet will be debited immediately. The carrier label will be issued after booking."}
                </p>
              </div>

              {bookingError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{bookingError}</p>
                </div>
              )}
            </div>
          )}

          {/* ── DONE STEP ── */}
          {step === "done" && booking && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center gap-3 text-center py-4">
                <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Booking submitted</p>
                  <p className="text-xs text-stone-500 mt-1">
                    {booking.carrierType === "trackam"
                      ? "The carrier will review and accept within 30 minutes."
                      : "Your booking is confirmed and label will be ready shortly."}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">Booking ID</span>
                  <span className="font-mono text-stone-300 text-right text-[11px]">{booking.id.slice(0, 16)}…</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Carrier</span>
                  <span className="text-stone-300">{booking.carrierName ?? booking.carrierType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Status</span>
                  <span className={booking.status === "accepted" ? "text-emerald-400" : "text-yellow-400"}>
                    {booking.status === "accepted" ? "Confirmed" : "Pending acceptance"}
                  </span>
                </div>
                {booking.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">Expires</span>
                    <span className="text-stone-400">{new Date(booking.expiresAt).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        {(step === "route" || step === "confirm" || step === "done") && (
          <div className="px-5 py-4 border-t border-white/[0.06] shrink-0">
            {step === "route" && (
              <button
                onClick={fetchRates}
                disabled={loadingRates || !originCity.trim() || !destCity.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white h-10 text-sm font-semibold transition-colors"
              >
                {loadingRates ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking rates…</> : <><ArrowRight className="h-4 w-4" /> Check rates</>}
              </button>
            )}
            {step === "confirm" && selected && (
              <button
                onClick={confirmBooking}
                disabled={booking_loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white h-10 text-sm font-semibold transition-colors"
              >
                {booking_loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Booking…</> : <><CheckCircle2 className="h-4 w-4" /> Confirm booking</>}
              </button>
            )}
            {step === "done" && (
              <button
                onClick={onClose}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-white h-10 text-sm font-medium transition-colors"
              >
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
