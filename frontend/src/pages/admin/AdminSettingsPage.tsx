import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Loader2, CheckCircle2, Building2, Fuel, AlertTriangle, Clock, Plug, Wallet, Truck,
  Globe, Phone, Link, Image, Plus, X, Eye, EyeOff, Users,
} from "lucide-react";
import { orgSettingsApi, type OrgSettings } from "@/services/admin.api";
import { carrierApi, type CarrierProfile, type CarrierProfileInput, type ServiceArea, type CapacityType, type PricingModel } from "@/services/carrier";
import { COUNTRY_OPTIONS } from "@/lib/idSchemes";
import AdminOliPage from "./AdminOliPage";
import AdminWalletPage from "./AdminWalletPage";

const TABS = [
  { id: "carrier",    label: "Carrier Profile", icon: Truck    },
  { id: "operations", label: "Operations",      icon: Fuel     },
  { id: "network",    label: "Network",         icon: Plug     },
  { id: "wallet",     label: "Wallet",          icon: Wallet   },
] as const;

type TabId = typeof TABS[number]["id"];

export default function AdminSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "carrier") as TabId;

  function setTab(id: TabId) {
    setSearchParams({ tab: id }, { replace: true });
  }

  return (
    <div className="max-w-3xl">
      <div className="flex border-b border-white/[0.06] mb-6 overflow-x-auto gap-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "flex items-center gap-2 px-4 pb-3 pt-1 text-sm font-medium border-b-2 whitespace-nowrap transition-colors shrink-0",
              tab === id
                ? "border-orange-500 text-white"
                : "border-transparent text-stone-500 hover:text-stone-300 hover:border-white/[0.2]",
            ].join(" ")}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "carrier"    && <CarrierTab />}
      {tab === "operations" && <OperationsTab />}
      {tab === "network"    && <AdminOliPage />}
      {tab === "wallet"     && <AdminWalletPage />}
    </div>
  );
}

// ── Shared primitives ────────────────────────────────────────────────────────

const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-10 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors";
const labelCls = "block text-xs font-medium text-stone-300 mb-1";
const hintCls  = "text-[11px] text-stone-600 mb-1.5";

function SectionCard({ icon, title, description, children }: {
  icon: React.ReactNode; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
      <header className="flex items-start gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="h-8 w-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">{icon}</div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="text-[11px] text-stone-500 mt-0.5">{description}</p>
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SaveRow({ saving, saved, label = "Save" }: { saving: boolean; saved: boolean; label?: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-5 h-10 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 disabled:opacity-60 transition-all"
      >
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : label}
      </button>
      {saved && (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <CheckCircle2 className="h-4 w-4" /> Saved
        </span>
      )}
    </div>
  );
}

// ── Carrier Profile tab ──────────────────────────────────────────────────────

const CAPACITY_OPTIONS: { value: CapacityType; label: string }[] = [
  { value: "motorcycle", label: "Motorcycle" },
  { value: "van",        label: "Van"        },
  { value: "truck",      label: "Truck"      },
  { value: "fleet",      label: "Fleet"      },
];

const PRICING_OPTIONS: { value: PricingModel; label: string; description: string }[] = [
  { value: "per_shipment", label: "Per shipment", description: "Flat rate per job"    },
  { value: "per_km",       label: "Per km",       description: "Rate per kilometre"   },
  { value: "quoted",       label: "Quoted",       description: "Price on request"     },
];

const SPECIALIZATION_OPTIONS = [
  "E-commerce fulfilment",
  "Cold chain / perishables",
  "Fragile & high-value",
  "Bulk cargo",
  "Last-mile delivery",
  "Inter-city logistics",
  "Same-day delivery",
  "Warehousing",
];

const EMPTY_AREA: ServiceArea = { city: "", state: "", country: "NG" };

function CarrierTab() {
  return (
    <div className="space-y-6">
      <BusinessIdentityForm />
      <CarrierNetworkForm />
    </div>
  );
}

function BusinessIdentityForm() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    orgSettingsApi.get().then((s) => {
      setForm(s as unknown as Record<string, string>);
      setLoaded(true);
    });
  }, []);

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      await orgSettingsApi.update(form as unknown as Partial<OrgSettings>);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  if (!loaded) return <div className="h-64 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />;

  const logoUrl = form.logo_url ?? "";

  return (
    <form onSubmit={handleSave}>
      <SectionCard
        icon={<Building2 className="h-4 w-4 text-stone-400" />}
        title="Business identity"
        description="How your company appears on waybills, receipts, and the carrier directory."
      >
        {/* Logo */}
        <div className="mb-5">
          <label className={labelCls}><span className="inline-flex items-center gap-1.5"><Image className="h-3 w-3" /> Logo</span></label>
          <p className={hintCls}>Paste a publicly accessible image URL. Shown on waybill PDFs and your carrier profile.</p>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center shrink-0 overflow-hidden">
              {logoUrl
                ? <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                : <Truck className="h-6 w-6 text-stone-600" />}
            </div>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setField("logo_url", e.target.value)}
              placeholder="https://example.com/logo.png"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Business name</label>
            <p className={hintCls}>Your trading or company name.</p>
            <input type="text" value={form.business_name ?? ""} onChange={(e) => setField("business_name", e.target.value)} placeholder="e.g. Redstar Logistics" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Business city</label>
            <p className={hintCls}>Primary base of operations.</p>
            <input type="text" value={form.business_city ?? ""} onChange={(e) => setField("business_city", e.target.value)} placeholder="e.g. Lagos" className={inputCls} />
          </div>
        </div>

        <div className="mb-4">
          <label className={labelCls}><span className="inline-flex items-center gap-1.5"><Globe className="h-3 w-3" /> Country</span></label>
          <p className={hintCls}>Determines ID scheme and phone dial code across the platform.</p>
          <select value={form.country ?? ""} onChange={(e) => setField("country", e.target.value)} className={inputCls}>
            {COUNTRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#0c1522]">{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className={labelCls}><span className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" /> Contact phone</span></label>
            <p className={hintCls}>WhatsApp or business line for carrier enquiries.</p>
            <input type="tel" value={form.contact_phone ?? ""} onChange={(e) => setField("contact_phone", e.target.value)} placeholder="+234 800 000 0000" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}><span className="inline-flex items-center gap-1.5"><Link className="h-3 w-3" /> Website</span></label>
            <p className={hintCls}>Public-facing website or booking page.</p>
            <input type="url" value={form.website_url ?? ""} onChange={(e) => setField("website_url", e.target.value)} placeholder="https://yourcompany.com" className={inputCls} />
          </div>
        </div>

        <SaveRow saving={saving} saved={saved} label="Save business info" />
      </SectionCard>
    </form>
  );
}

function CarrierNetworkForm() {
  const [profile, setProfile]             = useState<CarrierProfile | null>(null);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [toggling, setToggling]           = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [capacityType, setCapacityType]   = useState<CapacityType>("van");
  const [serviceAreas, setServiceAreas]   = useState<ServiceArea[]>([{ ...EMPTY_AREA }]);
  const [pricingModel, setPricingModel]   = useState<PricingModel>("quoted");
  const [baseRate, setBaseRate]           = useState("");
  const [currency, setCurrency]           = useState("NGN");
  const [bio, setBio]                     = useState("");
  const [fleetSize, setFleetSize]         = useState("");
  const [specializations, setSpecializations] = useState<string[]>([]);

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

  function toggleSpec(s: string) {
    setSpecializations((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSaving(true);
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
    } catch { setError("Failed to save profile. Please try again."); }
    finally { setSaving(false); }
  }

  async function handleTogglePublish() {
    if (!profile) return;
    setToggling(true);
    try {
      const updated = await carrierApi.setPublished(!profile.isPublished);
      setProfile(updated);
    } catch { setError("Failed to update visibility."); }
    finally { setToggling(false); }
  }

  if (loading) return <div className="h-64 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />;

  return (
    <form onSubmit={handleSave}>
      <SectionCard
        icon={<Truck className="h-4 w-4 text-stone-400" />}
        title="Carrier network profile"
        description="How your operation appears in the Trackam carrier directory."
      >
        {/* Publish toggle */}
        {profile && (
          <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 mb-5">
            <div>
              <p className="text-xs font-semibold text-stone-300">
                {profile.isPublished ? "Listed in directory" : "Not listed"}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {profile.isPublished ? "Other operators can find and contact you." : "Save your profile first, then publish to go live."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleTogglePublish}
              disabled={toggling}
              className={[
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 shrink-0 ml-3",
                profile.isPublished ? "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20" : "bg-white/[0.06] text-stone-300 hover:bg-white/[0.1]",
              ].join(" ")}
            >
              {profile.isPublished ? <><EyeOff className="h-3.5 w-3.5" /> Unpublish</> : <><Eye className="h-3.5 w-3.5" /> Publish</>}
            </button>
          </div>
        )}

        {/* Capacity type */}
        <div className="mb-4">
          <label className={labelCls}>Capacity type</label>
          <p className={hintCls}>Primary vehicle or fleet type.</p>
          <div className="flex flex-wrap gap-2">
            {CAPACITY_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setCapacityType(opt.value)}
                className={["rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  capacityType === opt.value ? "bg-orange-500/[0.15] text-orange-400 ring-1 ring-orange-500/30" : "bg-white/[0.04] text-stone-400 hover:bg-white/[0.08]",
                ].join(" ")}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fleet size */}
        <div className="mb-4">
          <label className={labelCls}><span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3" /> Fleet size</span></label>
          <p className={hintCls}>Total number of active vehicles in your operation.</p>
          <div className="flex items-center gap-2">
            <input
              type="number" min="1"
              value={fleetSize}
              onChange={(e) => setFleetSize(e.target.value)}
              placeholder="e.g. 12"
              className={`${inputCls} max-w-xs`}
            />
            <span className="text-xs text-stone-500">vehicles</span>
          </div>
        </div>

        {/* Service areas */}
        <div className="mb-4">
          <label className={labelCls}>Service areas</label>
          <p className={hintCls}>Cities and states your operation covers.</p>
          <div className="space-y-2 mb-2">
            {serviceAreas.map((area, i) => (
              <div key={i} className="flex items-center gap-2">
                <input placeholder="City" value={area.city} onChange={(e) => setServiceAreas((prev) => prev.map((a, idx) => idx === i ? { ...a, city: e.target.value } : a))}
                  className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none" />
                <input placeholder="State" value={area.state} onChange={(e) => setServiceAreas((prev) => prev.map((a, idx) => idx === i ? { ...a, state: e.target.value } : a))}
                  className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none" />
                <input placeholder="Country" value={area.country} onChange={(e) => setServiceAreas((prev) => prev.map((a, idx) => idx === i ? { ...a, country: e.target.value } : a))}
                  className="w-20 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none" />
                <button type="button" onClick={() => setServiceAreas((prev) => prev.filter((_, idx) => idx !== i))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 hover:bg-red-500/10 hover:text-red-400 transition-colors shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setServiceAreas((prev) => [...prev, { ...EMPTY_AREA }])}
            className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-orange-400 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add area
          </button>
        </div>

        {/* Specializations */}
        <div className="mb-4">
          <label className={labelCls}>Specializations</label>
          <p className={hintCls}>Select all that apply to your operation.</p>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATION_OPTIONS.map((s) => (
              <button key={s} type="button" onClick={() => toggleSpec(s)}
                className={["rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  specializations.includes(s) ? "bg-orange-500/[0.15] text-orange-400 ring-1 ring-orange-500/30" : "bg-white/[0.04] text-stone-400 hover:bg-white/[0.08]",
                ].join(" ")}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="mb-4">
          <label className={labelCls}>Pricing model</label>
          <p className={hintCls}>How you quote jobs to partner operators.</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {PRICING_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setPricingModel(opt.value)}
                className={["rounded-lg p-3 text-left transition-colors", pricingModel === opt.value ? "bg-orange-500/[0.1] ring-1 ring-orange-500/30" : "bg-white/[0.04] hover:bg-white/[0.06]"].join(" ")}>
                <p className={`text-xs font-medium ${pricingModel === opt.value ? "text-orange-400" : "text-stone-300"}`}>{opt.label}</p>
                <p className="text-[11px] text-stone-600 mt-0.5">{opt.description}</p>
              </button>
            ))}
          </div>
          {pricingModel !== "quoted" && (
            <div className="flex gap-2">
              <div className="flex-1">
                <input type="number" min="0" step="0.01" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} placeholder="0.00"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none" />
              </div>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none">
                {["NGN","USD","GHS","KES"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Bio */}
        <div className="mb-5">
          <label className={labelCls}>About your operation</label>
          <p className={hintCls}>Briefly describe your specialisation, coverage, or what makes you stand out.</p>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Briefly describe your logistics operation..."
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none resize-none" />
        </div>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <SaveRow saving={saving} saved={saved} label="Save carrier profile" />
      </SectionCard>
    </form>
  );
}

// ── Operations tab ───────────────────────────────────────────────────────────

function OperationsTab() {
  const [form, setForm]     = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    orgSettingsApi.get().then((s) => {
      setForm(s as unknown as Record<string, string>);
      setLoaded(true);
    });
  }, []);

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      await orgSettingsApi.update(form as unknown as Partial<OrgSettings>);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  if (!loaded) return (
    <div className="space-y-5 animate-pulse">
      {[1,2,3].map((i) => <div key={i} className="h-40 rounded-xl bg-white/[0.03] border border-white/[0.06]" />)}
    </div>
  );

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Cost calculation */}
      <SectionCard icon={<Fuel className="h-4 w-4 text-stone-400" />} title="Cost calculation" description="How Trackam estimates fuel costs across all dispatch runs.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Fuel price</label>
            <p className={hintCls}>Current petrol cost per litre.</p>
            <div className="flex items-center gap-2">
              <input type="number" value={form.fuel_price_per_litre ?? ""} onChange={(e) => setField("fuel_price_per_litre", e.target.value)} className={inputCls} />
              <span className="text-xs text-stone-500 shrink-0">/L</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Fuel efficiency</label>
            <p className={hintCls}>Litres consumed per km (default 0.12).</p>
            <div className="flex items-center gap-2">
              <input type="number" step="0.01" value={form.fuel_efficiency_multiplier ?? ""} onChange={(e) => setField("fuel_efficiency_multiplier", e.target.value)} className={inputCls} />
              <span className="text-xs text-stone-500 shrink-0">L/km</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Delivery targets */}
      <SectionCard icon={<Clock className="h-4 w-4 text-stone-400" />} title="Delivery targets" description="Default SLA and waybill configuration for your organisation.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>SLA target</label>
            <p className={hintCls}>Expected delivery window for standard shipments.</p>
            <div className="flex items-center gap-2">
              <input type="number" min="1" value={form.sla_target_hours ?? ""} onChange={(e) => setField("sla_target_hours", e.target.value)} placeholder="48" className={inputCls} />
              <span className="text-xs text-stone-500 shrink-0">hours</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Waybill prefix</label>
            <p className={hintCls}>Short code prepended to all waybill numbers.</p>
            <input type="text" value={form.waybill_prefix ?? ""} onChange={(e) => setField("waybill_prefix", e.target.value.toUpperCase())} placeholder="e.g. TRK" maxLength={6} className={inputCls} />
          </div>
        </div>
      </SectionCard>

      {/* Alerts */}
      <SectionCard icon={<AlertTriangle className="h-4 w-4 text-stone-400" />} title="Alerts" description="When to flag runs as at risk across the organisation.">
        <div>
          <label className={labelCls}><span className="inline-flex items-center gap-1.5"><Clock className="h-3 w-3" /> Ghost threshold</span></label>
          <p className={hintCls}>Hours without a status update before a run is flagged.</p>
          <div className="flex items-center gap-2">
            <input type="number" value={form.ghost_threshold_hours ?? ""} onChange={(e) => setField("ghost_threshold_hours", e.target.value)} className={`${inputCls} max-w-xs`} />
            <span className="text-xs text-stone-500">hours</span>
          </div>
        </div>
      </SectionCard>

      <SaveRow saving={saving} saved={saved} label="Save operations settings" />
    </form>
  );
}
