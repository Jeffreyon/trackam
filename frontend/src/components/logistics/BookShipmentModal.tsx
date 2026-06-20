import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Loader2, ArrowRight, ArrowLeft, CheckCircle2,
  Package, Truck, Zap, ChevronRight, AlertCircle, MapPin,
} from "lucide-react";
import { waybillApi, type OperatorWaybill } from "@/services/handover";
import { networkRateApi, networkBookingApi, type NetworkRate, type NetworkBooking, type CarrierDirectoryEntry } from "@/services/carrier";

type Step = "carrier" | "waybill" | "route" | "rates" | "confirm" | "done";

interface Props {
  onClose: () => void;
  initialWaybill?: OperatorWaybill;
  initialCarrier?: CarrierDirectoryEntry; // Flow 2: carrier-first
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
  const amountKobo   = Math.round(rate.totalCharge.amount * 100);
  const amountDisplay = rate.totalCharge.currency === "NGN"
    ? `₦${(rate.totalCharge.amount).toLocaleString("en-NG")}`
    : `${rate.totalCharge.currency} ${rate.totalCharge.amount.toLocaleString()}`;
  const capCls = CAPACITY_COLORS[rate.capacityType ?? ""] ?? "text-stone-400 bg-white/5 ring-white/10";

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

/** Build a synthetic NetworkRate from a directory entry — no network call needed. */
function rateFromCarrier(c: CarrierDirectoryEntry): NetworkRate {
  return {
    carrier:      "trackam",
    carrierId:    c.operatorId,
    carrierName:  c.name,
    serviceName:  "Trackam network",
    serviceCode:  `trackam_${c.operatorId}`,
    capacityType: c.capacityType,
    logoUrl:      c.logoUrl ?? null,
    country:      c.country ?? null,
    totalCharge:  { amount: c.baseRate / 100, currency: c.currency },
    transitDays:  null,
    deliveryBy:   null,
  };
}

export default function BookShipmentModal({ onClose, initialWaybill, initialCarrier }: Props) {
  const carrierFirstMode = !!initialCarrier;

  const [step, setStep]           = useState<Step>(
    initialCarrier ? "carrier" : initialWaybill ? "route" : "waybill"
  );
  const [waybills, setWaybills]   = useState<OperatorWaybill[]>([]);
  const [waybill, setWaybill]     = useState<OperatorWaybill | null>(initialWaybill ?? null);
  const [originCity, setOriginCity]   = useState("");
  const [destCity, setDestCity]       = useState("");
  const [countryCode, setCountryCode] = useState("NG");
  const [weightKg, setWeightKg]   = useState("");
  const [rates, setRates]         = useState<NetworkRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [ratesError, setRatesError]     = useState("");
  const [selected, setSelected]   = useState<NetworkRate | null>(
    initialCarrier ? rateFromCarrier(initialCarrier) : null
  );
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

  // Load waybills whenever picker is shown
  useEffect(() => {
    if (step === "waybill") {
      waybillApi.list().then(setWaybills).catch(() => {});
    }
  }, [step]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function selectWaybill(w: OperatorWaybill) {
    setWaybill(w);
    if (carrierFirstMode) {
      // Rate already known — skip route check, go straight to confirm
      setStep("confirm");
    } else {
      setStep("route");
    }
  }

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
      const safeRates = Array.isArray(result) ? result : [];
      setRates(safeRates);
      if (safeRates.length === 0) setRatesError("No carriers found for this route. Try different cities or check back later.");
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

  const trackamRates    = rates.filter(r => r.carrier === "trackam");
  const integratedRates = rates.filter(r => r.carrier !== "trackam");

  const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/40 focus:outline-none transition-colors";

  function goBack() {
    if (step === "route")   setStep("waybill");
    if (step === "rates")   setStep("route");
    if (step === "confirm") {
      if (carrierFirstMode) { setStep("waybill"); }
      else { setSelected(null); setStep("rates"); }
    }
    if (step === "waybill" && carrierFirstMode) setStep("carrier");
  }

  const headerTitle = {
    carrier: "Book a carrier",
    waybill: "Select waybill",
    route:   "Check carrier rates",
    rates:   "Choose a carrier",
    confirm: "Confirm booking",
    done:    "Booking submitted",
  }[step];

  const showBack = step !== "done" && !(step === "waybill" && !carrierFirstMode) && step !== "carrier";

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
            {showBack && (
              <button
                onClick={goBack}
                className="h-7 w-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-stone-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="h-8 w-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Truck className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">{headerTitle}</p>
              {waybill && step !== "waybill" && step !== "carrier" && (
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

          {/* ── CARRIER STEP (Flow 2 entry point) ── */}
          {step === "carrier" && initialCarrier && (() => {
            const rate = rateFromCarrier(initialCarrier);
            const capCls = CAPACITY_COLORS[initialCarrier.capacityType ?? ""] ?? "text-stone-400 bg-white/5 ring-white/10";
            const hasRate = initialCarrier.baseRate > 0 && initialCarrier.pricingModel !== "quoted";
            return (
              <div className="space-y-4">
                {/* Carrier identity */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 flex items-center gap-3">
                  <LogoOrAvatar logoUrl={initialCarrier.logoUrl} name={initialCarrier.name} size={12} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{initialCarrier.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ${capCls}`}>
                        {CAPACITY_LABELS[initialCarrier.capacityType] ?? initialCarrier.capacityType}
                      </span>
                      {initialCarrier.country && (
                        <span className="text-[11px] text-stone-500 uppercase">{initialCarrier.country}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                {initialCarrier.bio && (
                  <p className="text-xs text-stone-500 leading-relaxed">{initialCarrier.bio}</p>
                )}

                {/* Service areas */}
                {initialCarrier.serviceAreas.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-stone-600 font-semibold">Coverage</p>
                    <div className="flex flex-wrap gap-1.5">
                      {initialCarrier.serviceAreas.slice(0, 8).map((area, i) => (
                        <span key={i} className="flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-stone-500">
                          <MapPin className="h-2.5 w-2.5 shrink-0 text-stone-700" />
                          {area.city}{area.state ? `, ${area.state}` : ""}
                        </span>
                      ))}
                      {initialCarrier.serviceAreas.length > 8 && (
                        <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-stone-600">
                          +{initialCarrier.serviceAreas.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Rate */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-stone-600 font-semibold">Rate</p>
                  {hasRate ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-white">
                          {rate.totalCharge.currency === "NGN" ? "₦" : rate.totalCharge.currency + " "}
                          {rate.totalCharge.amount.toLocaleString("en-NG")}
                        </span>
                        <span className="text-xs text-stone-500">
                          {initialCarrier.pricingModel === "per_km" ? "per km" : "per shipment"}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600">5% platform fee deducted from carrier payout — you pay the listed rate.</p>
                    </>
                  ) : (
                    <p className="text-sm text-stone-500">Rate on request — carrier will confirm after reviewing your waybill.</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── WAYBILL PICKER ── */}
          {step === "waybill" && (
            <div className="space-y-2">
              <p className="text-xs text-stone-500">
                {carrierFirstMode
                  ? `Select the waybill you want ${initialCarrier?.name} to carry:`
                  : "Select the waybill you want to book a carrier for:"}
              </p>
              {waybills.length === 0 ? (
                <div className="py-10 text-center text-sm text-stone-600">Loading waybills…</div>
              ) : (
                waybills.filter(w => !w.isDelivered).map((w) => (
                  <button
                    key={w.id}
                    onClick={() => selectWaybill(w)}
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
                  <span className="text-stone-300">{waybill.pickupLocation} → {waybill.deliveryLocation}</span>
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
        {(step === "carrier" || step === "route" || step === "confirm" || step === "done") && (
          <div className="px-5 py-4 border-t border-white/[0.06] shrink-0">
            {step === "carrier" && (
              <button
                onClick={() => setStep("waybill")}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white h-10 text-sm font-semibold transition-colors"
              >
                <ArrowRight className="h-4 w-4" /> Select a waybill
              </button>
            )}
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
