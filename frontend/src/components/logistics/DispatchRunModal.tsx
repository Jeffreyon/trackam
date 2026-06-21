import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Loader2, ArrowRight, CheckCircle2, Package, Truck,
  ChevronRight, AlertCircle, MapPin, QrCode, Globe,
} from "lucide-react";
import { runsApi, type DispatchRun } from "@/services/runs";
import { runBookingApi, networkRateApi, type RunBooking, type CarrierDirectoryEntry } from "@/services/carrier";
import { CityAutocomplete } from "@/components/common/CityAutocomplete";
import { formatNaira } from "@/lib/format";

type Step = "setup" | "confirm" | "done";

interface Props {
  carrier: CarrierDirectoryEntry;
  onClose: () => void;
}

const CAPACITY_LABELS: Record<string, string> = {
  motorcycle: "Motorcycle",
  van:        "Van",
  truck:      "Truck",
  fleet:      "Fleet",
};

function LogoOrAvatar({ logoUrl, name }: { logoUrl?: string | null; name: string }) {
  const [err, setErr] = useState(false);
  if (logoUrl && !err) {
    return (
      <img src={logoUrl} alt={name} onError={() => setErr(true)}
        className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/10 shrink-0" />
    );
  }
  const initials = (() => {
    const p = name.trim().split(/\s+/);
    return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
  })();
  return (
    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-700/10 ring-1 ring-orange-500/20 flex items-center justify-center shrink-0">
      <span className="text-[10px] font-bold text-orange-300">{initials}</span>
    </div>
  );
}

export default function DispatchRunModal({ carrier, onClose }: Props) {
  const [step, setStep]           = useState<Step>("setup");
  const [runs, setRuns]           = useState<DispatchRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<DispatchRun | null>(null);
  const [originCity, setOriginCity]   = useState("");
  const [destCity, setDestCity]       = useState("");
  const [rate, setRate]               = useState<number | null>(null); // kobo
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError]     = useState("");
  const [booking, setBooking]         = useState<RunBooking | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError]     = useState("");

  useEffect(() => {
    runsApi.list()
      .then((list) => setRuns(list.filter((r) => r.status === "loading" || r.status === "in_transit")))
      .catch(() => setRuns([]))
      .finally(() => setRunsLoading(false));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleContinue() {
    if (!selectedRun || !originCity.trim() || !destCity.trim()) {
      setRateError("Select a run and enter both cities.");
      return;
    }
    setRateError("");
    setRateLoading(true);
    try {
      const results = await networkRateApi.check({
        origin:      { countryCode: "ng", cityName: originCity.trim() },
        destination: { countryCode: "ng", cityName: destCity.trim() },
        packages:    [{ weight: { value: 1, unit: "kg" } }],
        distanceKm:  selectedRun.distanceKm || null,
      });
      // Find this carrier's rate
      const match = results.find((r) => r.carrier === "trackam" && r.carrierId === carrier.operatorId);
      const kobo = match
        ? Math.round(match.totalCharge.amount * 100)
        : Math.round((carrier.baseRate / 100) * 100); // fallback: base rate
      setRate(kobo);
      setStep("confirm");
    } catch {
      setRateError("Could not fetch carrier rate. Check your OLI connection.");
    } finally {
      setRateLoading(false);
    }
  }

  async function handleConfirm() {
    if (!selectedRun || rate == null) return;
    setBookingLoading(true);
    setBookingError("");
    try {
      // Need waybill IDs from the run — fetch the detail
      const detail = await runsApi.get(selectedRun.id);
      const waybillIds = detail.legs
        .map((l) => l.waybillId)
        .filter((w): w is string => Boolean(w));

      if (!waybillIds.length) {
        setBookingError("This run has no OLI waybills loaded yet. Add waybills before dispatching to a carrier.");
        return;
      }

      const result = await runBookingApi.create({
        carrierOperatorId: carrier.operatorId,
        originCity:        originCity.trim(),
        destCity:          destCity.trim(),
        distanceKm:        selectedRun.distanceKm || undefined,
        quotedRateKobo:    rate,
        sourceRunId:       selectedRun.id,
        waybillIds,
      });
      setBooking(result);
      setStep("done");
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      const msg    = (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message
                  ?? (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setBookingError(
        status === 402 ? "Insufficient wallet balance. Top up your OLI Switch wallet and try again." :
        status === 403 ? "One or more waybills don't belong to your account." :
        msg ?? "Booking failed. Please try again."
      );
    } finally {
      setBookingLoading(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/40 focus:outline-none transition-colors";
  const canContinue = !!selectedRun && originCity.trim().length >= 2 && destCity.trim().length >= 2;

  const panel = (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-xl bg-[#0c1522] shadow-2xl shadow-black/50 border border-white/[0.08] overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <Globe className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {step === "setup"   && "Dispatch a run"}
                {step === "confirm" && "Confirm dispatch"}
                {step === "done"    && "Booking sent"}
              </p>
              <p className="text-[11px] text-stone-500">via {carrier.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-stone-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* ── Carrier identity strip (always visible in setup + confirm) ── */}
          {step !== "done" && (
            <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
              <LogoOrAvatar logoUrl={carrier.logoUrl} name={carrier.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{carrier.name}</p>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-[11px] text-stone-500 uppercase">{CAPACITY_LABELS[carrier.capacityType] ?? carrier.capacityType}</span>
                  {carrier.serviceAreas.slice(0, 3).map((a, i) => (
                    <span key={i} className="flex items-center gap-0.5 text-[11px] text-stone-600">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />{a.city}
                    </span>
                  ))}
                  {carrier.serviceAreas.length > 3 && (
                    <span className="text-[11px] text-stone-700">+{carrier.serviceAreas.length - 3}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SETUP STEP ── */}
          {step === "setup" && (
            <>
              {/* City pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-stone-400 block mb-1.5">Origin city</label>
                  <CityAutocomplete value={originCity} onChange={setOriginCity} placeholder="e.g. Lagos" className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-stone-400 block mb-1.5">Destination city</label>
                  <CityAutocomplete value={destCity} onChange={setDestCity} placeholder="e.g. Abuja" className={inputCls} />
                </div>
              </div>

              {/* Run picker */}
              <div>
                <p className="text-[11px] font-medium text-stone-400 mb-2">Select a run to dispatch</p>
                {runsLoading ? (
                  <div className="flex items-center justify-center h-24 text-stone-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : runs.length === 0 ? (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] py-8 text-center space-y-1">
                    <Package className="h-5 w-5 text-stone-600 mx-auto" />
                    <p className="text-xs text-stone-500">No active runs.</p>
                    <p className="text-[11px] text-stone-700">Create a run from the Dispatch Runs page first.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {runs.map((run) => (
                      <button
                        key={run.id}
                        onClick={() => setSelectedRun(run)}
                        className={`w-full text-left flex items-center gap-3 rounded-lg border p-3 transition-all ${
                          selectedRun?.id === run.id
                            ? "border-orange-500/40 bg-orange-500/[0.07]"
                            : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.1] hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="h-8 w-8 rounded-md bg-white/[0.06] flex items-center justify-center shrink-0">
                          <Truck className="h-4 w-4 text-stone-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-200 truncate">
                            {run.name ?? `Run — ${new Date(run.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}`}
                          </p>
                          <p className="text-[11px] text-stone-500 mt-0.5">
                            {run.legCount} waybill{run.legCount !== 1 ? "s" : ""}
                            {run.distanceKm > 0 && ` · ${run.distanceKm} km`}
                            <span className={`ml-2 inline-block rounded px-1 py-0.5 text-[9px] font-semibold uppercase ${
                              run.status === "loading" ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"
                            }`}>{run.status === "loading" ? "Loading" : "In transit"}</span>
                          </p>
                        </div>
                        {selectedRun?.id === run.id
                          ? <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-stone-700 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {rateError && (
                <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{rateError}
                </p>
              )}
            </>
          )}

          {/* ── CONFIRM STEP ── */}
          {step === "confirm" && selectedRun && rate != null && (
            <>
              {/* Run summary */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Run</span>
                  <span className="font-medium text-stone-200">
                    {selectedRun.name ?? `Run — ${new Date(selectedRun.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Route</span>
                  <span className="flex items-center gap-1 font-medium text-stone-200">
                    {originCity} <ArrowRight className="h-3 w-3 text-stone-600" /> {destCity}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Waybills</span>
                  <span className="font-medium text-stone-200">{selectedRun.legCount}</span>
                </div>
                {selectedRun.distanceKm > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Distance</span>
                    <span className="font-medium text-stone-200">{selectedRun.distanceKm} km</span>
                  </div>
                )}
                <div className="border-t border-white/[0.06] pt-2 flex items-center justify-between">
                  <span className="text-stone-400 font-medium">You pay</span>
                  <span className="text-white font-bold text-sm">{formatNaira(rate / 100)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-stone-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Payment is deducted when the carrier accepts. You'll receive a drop-off QR to show at their hub — carrier staff scan it to confirm receipt and transfer OLI custody.
                </p>
              </div>

              {bookingError && (
                <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{bookingError}
                </p>
              )}
            </>
          )}

          {/* ── DONE STEP ── */}
          {step === "done" && booking && (
            <div className="py-4 space-y-4">
              <div className="flex flex-col items-center gap-3 text-center py-4">
                <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Booking sent</p>
                  <p className="text-xs text-stone-500 mt-1">
                    {carrier.name} will review and accept within 30 minutes. You'll see the drop-off QR in My Bookings once accepted.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">Carrier</span>
                  <span className="text-stone-300">{carrier.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Route</span>
                  <span className="flex items-center gap-1 text-stone-300">
                    {booking.originCity} <ArrowRight className="h-3 w-3 text-stone-600" /> {booking.destCity}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Status</span>
                  <span className="text-amber-400">Pending acceptance</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.06] shrink-0">
          {step === "setup" && (
            <button
              onClick={handleContinue}
              disabled={!canContinue || rateLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 h-10 text-sm font-semibold text-white disabled:opacity-50 transition-all"
            >
              {rateLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking rate…</>
                : <><ArrowRight className="h-4 w-4" /> Review & confirm</>}
            </button>
          )}
          {step === "confirm" && (
            <div className="flex gap-2">
              <button onClick={() => setStep("setup")}
                className="flex-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 h-10 text-xs font-medium text-stone-400 hover:text-white hover:bg-white/[0.06] transition-all">
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={bookingLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 h-10 text-sm font-semibold text-white disabled:opacity-50 transition-all"
              >
                {bookingLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Booking…</>
                  : <><QrCode className="h-4 w-4" /> Send booking request</>}
              </button>
            </div>
          )}
          {step === "done" && (
            <button
              onClick={onClose}
              className="w-full inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-white h-10 text-sm font-medium transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
