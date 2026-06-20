import { useEffect, useState } from "react";
import { Plus, X, Save, Eye, EyeOff, Package, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { carrierApi, networkBookingApi, type CarrierProfile, type CarrierProfileInput, type ServiceArea, type CapacityType, type PricingModel, type NetworkBooking } from "@/services/carrier";

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

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Pending",    cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  accepted:   { label: "Accepted",   cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  rejected:   { label: "Rejected",   cls: "text-red-400 bg-red-500/10 border-red-500/20" },
  expired:    { label: "Expired",    cls: "text-stone-500 bg-white/5 border-white/10" },
  in_transit: { label: "In transit", cls: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  delivered:  { label: "Delivered",  cls: "text-teal-400 bg-teal-500/10 border-teal-500/20" },
};

function IncomingBookings() {
  const [bookings, setBookings]   = useState<NetworkBooking[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState(true);
  const [acting, setActing]       = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await networkBookingApi.listIncoming({ limit: 20 });
      setBookings(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function accept(id: string) {
    setActing(id + "_accept");
    try {
      await networkBookingApi.accept(id);
      await load();
    } catch { /* ignore */ }
    finally { setActing(null); }
  }

  async function reject(id: string) {
    setActing(id + "_reject");
    try {
      await networkBookingApi.reject(id);
      await load();
    } catch { /* ignore */ }
    finally { setActing(null); }
  }

  const pending = bookings.filter(b => b.status === "pending");

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Package className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-medium text-white">Incoming bookings</span>
          {pending.length > 0 && (
            <span className="rounded-full bg-orange-500/15 border border-orange-500/25 text-orange-400 text-[10px] font-semibold px-1.5 py-0.5">
              {pending.length} pending
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-stone-600" /> : <ChevronDown className="h-4 w-4 text-stone-600" />}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06]">
          {loading ? (
            <div className="px-4 py-6 text-center text-xs text-stone-600">Loading…</div>
          ) : bookings.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-stone-500">No incoming bookings yet</p>
              <p className="text-xs text-stone-700 mt-1">Bookings from other operators appear here for you to accept.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {bookings.map(b => {
                const stCfg = STATUS_CONFIG[b.status] ?? { label: b.status, cls: "text-stone-400 bg-white/5 border-white/10" };
                const rateNgn = b.quotedRateKobo / 100;
                return (
                  <div key={b.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-mono font-semibold text-stone-200">{b.waybillNumber ?? "—"}</p>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${stCfg.cls}`}>{stCfg.label}</span>
                      </div>
                      <p className="text-[11px] text-stone-500 truncate">{b.pickupLocation} → {b.deliveryLocation}</p>
                      {b.goodsDescription && (
                        <p className="text-[11px] text-stone-600 truncate">{b.goodsDescription}</p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-stone-500 pt-0.5">
                        <span className="font-medium text-stone-300">₦{rateNgn.toLocaleString("en-NG")}</span>
                        <span className="text-stone-700">·</span>
                        <span>{b.bookerName ?? "Unknown operator"}</span>
                        {b.expiresAt && b.status === "pending" && (
                          <>
                            <span className="text-stone-700">·</span>
                            <Clock className="h-2.5 w-2.5" />
                            <span>Expires {new Date(b.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {b.status === "pending" && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => accept(b.id)}
                          disabled={acting !== null}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 px-3 h-8 text-xs font-medium hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {acting === b.id + "_accept" ? "…" : "Accept"}
                        </button>
                        <button
                          onClick={() => reject(b.id)}
                          disabled={acting !== null}
                          className="inline-flex items-center gap-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-stone-400 px-3 h-8 text-xs font-medium hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {acting === b.id + "_reject" ? "…" : "Reject"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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
      <IncomingBookings />

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
