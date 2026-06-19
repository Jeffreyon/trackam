import { useEffect, useState } from "react";
import { Globe, Plus, X, Save, Eye, EyeOff } from "lucide-react";
import { carrierApi, type CarrierProfile, type CarrierProfileInput, type ServiceArea, type CapacityType, type PricingModel } from "@/services/carrier";

const CAPACITY_OPTIONS: { value: CapacityType; label: string }[] = [
  { value: "motorcycle", label: "Motorcycle" },
  { value: "van",        label: "Van" },
  { value: "truck",      label: "Truck" },
  { value: "fleet",      label: "Fleet" },
];

const PRICING_OPTIONS: { value: PricingModel; label: string; description: string }[] = [
  { value: "per_shipment", label: "Per shipment", description: "Flat rate per job" },
  { value: "per_km",       label: "Per km",       description: "Rate per kilometre" },
  { value: "quoted",       label: "Quoted",       description: "Price on request" },
];

const EMPTY_AREA: ServiceArea = { city: "", state: "", country: "NG" };

function ServiceAreaRow({
  area,
  index,
  onChange,
  onRemove,
}: {
  area: ServiceArea;
  index: number;
  onChange: (i: number, field: keyof ServiceArea, value: string) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        placeholder="City"
        value={area.city}
        onChange={(e) => onChange(index, "city", e.target.value)}
        className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none"
      />
      <input
        placeholder="State"
        value={area.state}
        onChange={(e) => onChange(index, "state", e.target.value)}
        className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none"
      />
      <input
        placeholder="Country"
        value={area.country}
        onChange={(e) => onChange(index, "country", e.target.value)}
        className="w-20 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 hover:bg-red-500/10 hover:text-red-400 transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function CarrierProfilePage() {
  const [profile, setProfile] = useState<CarrierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [capacityType, setCapacityType] = useState<CapacityType>("van");
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([{ ...EMPTY_AREA }]);
  const [pricingModel, setPricingModel] = useState<PricingModel>("quoted");
  const [baseRate, setBaseRate] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [bio, setBio] = useState("");

  useEffect(() => {
    carrierApi.getProfile().then((p) => {
      if (p) {
        setProfile(p);
        setCapacityType(p.capacityType);
        setServiceAreas(p.serviceAreas.length > 0 ? p.serviceAreas : [{ ...EMPTY_AREA }]);
        setPricingModel(p.pricingModel);
        setBaseRate(p.baseRate > 0 ? String(p.baseRate / 100) : "");
        setCurrency(p.currency);
        setBio(p.bio || "");
      }
      setLoading(false);
    });
  }, []);

  function handleAreaChange(i: number, field: keyof ServiceArea, value: string) {
    setServiceAreas((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  }

  function handleAreaRemove(i: number) {
    setServiceAreas((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const input: CarrierProfileInput = {
        capacityType,
        serviceAreas: serviceAreas.filter((a) => a.city.trim()),
        pricingModel,
        baseRate: baseRate ? Math.round(parseFloat(baseRate) * 100) : 0,
        currency,
        bio: bio.trim() || undefined,
      };
      const updated = await carrierApi.saveProfile(input);
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish() {
    if (!profile) return;
    setToggling(true);
    try {
      const updated = await carrierApi.setPublished(!profile.isPublished);
      setProfile(updated);
    } catch {
      setError("Failed to update visibility.");
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-white/[0.06] bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold text-white">Carrier Profile</h2>
        <p className="text-sm text-stone-500">
          Configure how your operation appears in the Trackam carrier network.
        </p>
      </div>

      {/* Publish toggle */}
      {profile && (
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">
              {profile.isPublished ? "Listed in directory" : "Not listed"}
            </p>
            <p className="text-xs text-stone-500">
              {profile.isPublished
                ? "Other operators can find and contact you."
                : "Save your profile first, then publish to go live."}
            </p>
          </div>
          <button
            onClick={handleTogglePublish}
            disabled={toggling}
            className={[
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
              profile.isPublished
                ? "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                : "bg-white/[0.06] text-stone-300 hover:bg-white/[0.1]",
            ].join(" ")}
          >
            {profile.isPublished ? (
              <><EyeOff className="h-3.5 w-3.5" /> Unpublish</>
            ) : (
              <><Eye className="h-3.5 w-3.5" /> Publish</>
            )}
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Capacity type */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
          <label className="text-sm font-medium text-stone-300">Capacity type</label>
          <div className="flex flex-wrap gap-2">
            {CAPACITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCapacityType(opt.value)}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  capacityType === opt.value
                    ? "bg-orange-500/[0.15] text-orange-400 ring-1 ring-orange-500/30"
                    : "bg-white/[0.04] text-stone-400 hover:bg-white/[0.08]",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Service areas */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
          <label className="text-sm font-medium text-stone-300">Service areas</label>
          <div className="space-y-2">
            {serviceAreas.map((area, i) => (
              <ServiceAreaRow
                key={i}
                area={area}
                index={i}
                onChange={handleAreaChange}
                onRemove={handleAreaRemove}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setServiceAreas((prev) => [...prev, { ...EMPTY_AREA }])}
            className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-orange-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add area
          </button>
        </div>

        {/* Pricing */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
          <label className="text-sm font-medium text-stone-300">Pricing</label>
          <div className="grid grid-cols-3 gap-2">
            {PRICING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPricingModel(opt.value)}
                className={[
                  "rounded-lg p-3 text-left transition-colors",
                  pricingModel === opt.value
                    ? "bg-orange-500/[0.1] ring-1 ring-orange-500/30"
                    : "bg-white/[0.04] hover:bg-white/[0.06]",
                ].join(" ")}
              >
                <p className={`text-xs font-medium ${pricingModel === opt.value ? "text-orange-400" : "text-stone-300"}`}>
                  {opt.label}
                </p>
                <p className="text-[11px] text-stone-600 mt-0.5">{opt.description}</p>
              </button>
            ))}
          </div>
          {pricingModel !== "quoted" && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-stone-500 mb-1 block">
                  Base rate ({pricingModel === "per_km" ? "per km" : "per shipment"})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={baseRate}
                  onChange={(e) => setBaseRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none"
                >
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                  <option value="GHS">GHS</option>
                  <option value="KES">KES</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Bio */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
          <label className="text-sm font-medium text-stone-300">About your operation</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Briefly describe your logistics operation, specialisation, or coverage..."
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : saved ? "Saved!" : "Save profile"}
        </button>
      </form>
    </div>
  );
}
