import { useState } from "react";
import { Download, ArrowRight, Loader2, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { publicWaybillApi } from "@/services/handover";
import { PublicNav } from "@/components/layout/PublicNav";
import { PhoneInput } from "@/components/PhoneInput";

type Phase = "form" | "submitting" | "done";

interface WaybillResult {
  id: string;
  waybillNumber: string;
  claimToken: string | null;
}

const BLANK_FORM = {
  senderName: "",
  senderPhone: "",
  senderEmail: "",
  receiverName: "",
  receiverPhone: "",
  receiverEmail: "",
  receiverAddress: "",
  goodsDescription: "",
  pickupLocation: "",
  deliveryLocation: "",
  estimatedWeightKg: "",
  declaredValueNgn: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
};

export default function WaybillGeneratorPage() {
  const [phase, setPhase]   = useState<Phase>("form");
  const [result, setResult] = useState<WaybillResult | null>(null);
  const [error, setError]   = useState("");
  const [form, setForm]     = useState(BLANK_FORM);

  function field(name: keyof typeof form) {
    return {
      value: form[name],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((prev) => ({ ...prev, [name]: e.target.value })),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("submitting");
    setError("");
    try {
      const { lengthCm, widthCm, heightCm, ...rest } = form;
      const hasDims = lengthCm && widthCm && heightCm;
      const payload = {
        ...rest,
        estimatedWeightKg: form.estimatedWeightKg ? parseFloat(form.estimatedWeightKg) : undefined,
        declaredValueNgn:  form.declaredValueNgn  ? parseFloat(form.declaredValueNgn)  : undefined,
        dimensionsCm: hasDims
          ? { length: parseFloat(lengthCm), width: parseFloat(widthCm), height: parseFloat(heightCm) }
          : undefined,
      };
      const waybill = await publicWaybillApi.create(payload);
      setResult(waybill);
      setPhase("done");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to generate waybill.";
      setError(msg);
      setPhase("form");
    }
  }

  function handleReset() {
    setPhase("form");
    setResult(null);
    setError("");
    setForm(BLANK_FORM);
  }

  const inputCls = "w-full rounded-md border border-white/[0.08] bg-white/[0.06] px-3 h-10 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40";
  const labelCls = "text-xs font-medium text-white block mb-1.5";

  return (
    <div className="min-h-screen bg-[#060d18] text-white">
      <PublicNav />

      <div className="max-w-xl mx-auto px-4 pt-24 pb-12">
        {/* Hero */}
        <div className="mb-7">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 px-3 py-1 text-[11px] font-medium text-orange-400 mb-3">
            Open Logistics Interconnect (OLI)
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight">
            Generate a free digital waybill
          </h1>
          <p className="text-sm text-stone-400 mt-2">
            Creates a QR-coded waybill compatible with any OLI-enabled logistics app. No account needed.
          </p>
        </div>

        {/* Done */}
        {phase === "done" && result ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-500/20 bg-white/[0.03] p-5 text-center space-y-2">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-green-500/15 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="text-base font-semibold text-white">Waybill created</p>
              <p className="text-sm text-stone-400 font-mono">{result.waybillNumber}</p>
            </div>

            {result.claimToken && (
              <div className="rounded-xl border-2 border-orange-500/30 bg-orange-500/10 p-5 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-orange-300 uppercase tracking-wide">Operator Claim Code</p>
                  <p className="text-[11px] text-orange-400/80 mt-0.5">Give this to the courier or logistics operator at pickup.</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-bold font-mono tracking-widest text-orange-200 flex-1">{result.claimToken}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(result!.claimToken!)}
                    className="rounded-md border border-orange-500/30 bg-white/[0.03] px-3 h-9 text-xs font-medium text-orange-400 hover:bg-orange-500/20 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                </div>
                <p className="text-[11px] text-orange-400/80">
                  Single-use · The operator enters this code with the waybill number to register the shipment.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <a
                href={publicWaybillApi.pdfUrl(result.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 text-white h-10 text-sm font-medium hover:bg-orange-700 transition-colors"
              >
                <Download className="h-4 w-4" /> Download PDF
              </a>
              <a
                href={`/track/${result.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] text-white h-10 text-sm font-medium hover:bg-white/[0.05] transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> View tracking page
              </a>
              <button
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-1.5 text-xs text-stone-400 hover:text-white transition-colors"
              >
                Generate another
              </button>
            </div>
            <p className="text-[11px] text-center text-stone-400">
              The PDF QR code links to the tracking page. Anyone can scan it to see every custody event.
            </p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Sender */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Sender</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Full name <span className="text-red-500">*</span></label>
                  <input required {...field("senderName")} placeholder="Adaeze Nwosu" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone <span className="text-red-500">*</span></label>
                  <PhoneInput
                    value={form.senderPhone}
                    onChange={(v) => setForm((prev) => ({ ...prev, senderPhone: v }))}
                    required
                    size="md"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Email <span className="text-red-500">*</span></label>
                <input required type="email" {...field("senderEmail")} placeholder="adaeze@example.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Pickup location <span className="text-red-500">*</span></label>
                <input required {...field("pickupLocation")} placeholder="e.g. Alaba Market, Lagos" className={inputCls} />
              </div>
            </div>

            {/* Receiver */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Receiver</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Full name <span className="text-red-500">*</span></label>
                  <input required {...field("receiverName")} placeholder="Emeka Dike" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone <span className="text-red-500">*</span></label>
                  <PhoneInput
                    value={form.receiverPhone}
                    onChange={(v) => setForm((prev) => ({ ...prev, receiverPhone: v }))}
                    required
                    size="md"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Email <span className="text-red-500">*</span></label>
                <input required type="email" {...field("receiverEmail")} placeholder="emeka@example.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Delivery address <span className="text-red-500">*</span></label>
                <input required {...field("receiverAddress")} placeholder="12 Wuse Zone 5, Abuja" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Delivery location <span className="text-red-500">*</span></label>
                <input required {...field("deliveryLocation")} placeholder="e.g. Wuse, Abuja" className={inputCls} />
              </div>
            </div>

            {/* Cargo */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Cargo</p>
              <div>
                <label className={labelCls}>Goods description <span className="text-red-500">*</span></label>
                <input required {...field("goodsDescription")} placeholder="e.g. 10 cartons of electronics" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Est. weight (kg)</label>
                  <input {...field("estimatedWeightKg")} placeholder="e.g. 15" inputMode="decimal" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Declared value (₦)</label>
                  <input {...field("declaredValueNgn")} placeholder="e.g. 150000" inputMode="decimal" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Dimensions (cm) <span className="text-stone-600 font-normal">— L × W × H, required for carrier rates</span></label>
                <div className="grid grid-cols-3 gap-2">
                  <input {...field("lengthCm")} placeholder="Length" inputMode="decimal" className={inputCls} />
                  <input {...field("widthCm")}  placeholder="Width"  inputMode="decimal" className={inputCls} />
                  <input {...field("heightCm")} placeholder="Height" inputMode="decimal" className={inputCls} />
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">{error}</p>}

            <button
              type="submit"
              disabled={phase === "submitting"}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 text-white h-11 text-sm font-semibold transition-colors hover:bg-orange-700 disabled:opacity-60"
            >
              {phase === "submitting"
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                : <><ArrowRight className="h-4 w-4" /> Generate waybill</>}
            </button>

            <p className="text-[11px] text-center text-stone-400">
              By generating a waybill you agree to the OLI open data terms.{" "}
              <a href="https://github.com/open-logistics-ng" target="_blank" rel="noopener noreferrer" className="underline">Learn more</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
