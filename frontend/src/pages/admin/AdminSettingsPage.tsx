import { useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Loader2, CheckCircle2, Building2, Fuel, AlertTriangle, Clock, Plug, Wallet, Truck,
  Phone, Link2, Plus, X, Eye, EyeOff, Users, Pencil, ChevronDown,
} from "lucide-react";
import { orgSettingsApi, type OrgSettings } from "@/services/admin.api";
import { carrierApi, type CarrierProfile, type CarrierProfileInput, type ServiceArea, type CapacityType, type PricingModel } from "@/services/carrier";
import { COUNTRY_OPTIONS, COUNTRY_PHONE_CONFIGS } from "@/lib/idSchemes";
import AdminOliPage from "./AdminOliPage";
import AdminWalletPage from "./AdminWalletPage";

// ── Country data ─────────────────────────────────────────────────────────────

const COUNTRY_CURRENCY: Record<string, string> = {
  ng: "NGN", gh: "GHS", ke: "KES", za: "ZAR", rw: "RWF",
};

const COUNTRY_STATES: Record<string, string[]> = {
  ng: [
    "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
    "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo",
    "Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa",
    "Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba",
    "Yobe","Zamfara",
  ],
  gh: [
    "Ahafo","Ashanti","Bono","Bono East","Central","Eastern","Greater Accra",
    "North East","Northern","Oti","Savannah","Upper East","Upper West","Volta",
    "Western","Western North",
  ],
  ke: [
    "Baringo","Bomet","Bungoma","Busia","Elgeyo-Marakwet","Embu","Garissa",
    "Homa Bay","Isiolo","Kajiado","Kakamega","Kericho","Kiambu","Kilifi",
    "Kirinyaga","Kisii","Kisumu","Kitui","Kwale","Laikipia","Lamu","Machakos",
    "Makueni","Mandera","Marsabit","Meru","Migori","Mombasa","Murang'a","Nairobi",
    "Nakuru","Nandi","Narok","Nyamira","Nyandarua","Nyeri","Samburu","Siaya",
    "Taita-Taveta","Tana River","Tharaka-Nithi","Trans-Nzoia","Turkana",
    "Uasin Gishu","Vihiga","Wajir","West Pokot",
  ],
  za: [
    "Eastern Cape","Free State","Gauteng","KwaZulu-Natal","Limpopo","Mpumalanga",
    "North West","Northern Cape","Western Cape",
  ],
  rw: ["Eastern","Kigali","Northern","Southern","Western"],
};

function countryCurrency(code: string): string {
  return COUNTRY_CURRENCY[code] ?? "USD";
}

// Flag image — matches PhoneInput's CountryFlag: SVG from flagcdn.com, same size + shadow
function FlagImg({ code }: { code: string }) {
  const [errored, setErrored] = useState(false);
  const name = COUNTRY_PHONE_CONFIGS[code]?.name ?? code.toUpperCase();
  const fallback = COUNTRY_PHONE_CONFIGS[code]?.flag ?? "";

  if (errored) {
    return <span className="text-base leading-none shrink-0" aria-label={name}>{fallback}</span>;
  }

  return (
    <img
      src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
      alt={name}
      width={20}
      height={14}
      onError={() => setErrored(true)}
      className="h-3.5 w-5 object-cover rounded-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] shrink-0"
    />
  );
}

// Custom country dropdown — renders FlagImg so it works everywhere
function CountryDropdown({ value, onChange, className }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = COUNTRY_OPTIONS.find((o) => o.value === value) ?? COUNTRY_OPTIONS[0];

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-10 text-sm text-white focus:outline-none focus:border-orange-500/40 transition-colors"
      >
        <FlagImg code={selected.value} />
        <span className="flex-1 text-left truncate">{selected.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-stone-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-white/[0.08] bg-[#0f1a2a] shadow-xl overflow-hidden">
          {COUNTRY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={[
                "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors",
                value === opt.value ? "bg-orange-500/10 text-orange-400" : "text-stone-300 hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <FlagImg code={opt.value} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact version for inline use (service area row, etc.)
function CountryDropdownCompact({ value, onChange, className }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = COUNTRY_OPTIONS.find((o) => o.value === value) ?? COUNTRY_OPTIONS[0];

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 h-[38px] text-xs text-white focus:outline-none transition-colors w-full"
      >
        <FlagImg code={selected.value} />
        <span className="flex-1 text-left truncate text-stone-400">{selected.value.toUpperCase()}</span>
        <ChevronDown className="h-3 w-3 text-stone-600 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full right-0 mt-1 w-40 rounded-lg border border-white/[0.08] bg-[#0f1a2a] shadow-xl overflow-hidden">
          {COUNTRY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={[
                "w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors",
                value === opt.value ? "bg-orange-500/10 text-orange-400" : "text-stone-300 hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <FlagImg code={opt.value} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Resize image to max 256px, returns base64 JPEG
async function resizeLogo(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX = 256;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

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
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.03]">
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

// ── Carrier tab ──────────────────────────────────────────────────────────────

function CarrierTab() {
  const [country, setCountry] = useState("ng");
  const [countryLoaded, setCountryLoaded] = useState(false);

  useEffect(() => {
    orgSettingsApi.get().then((s) => {
      if ((s as Record<string, unknown>).country) {
        setCountry((s as Record<string, unknown>).country as string);
      }
      setCountryLoaded(true);
    });
  }, []);

  if (!countryLoaded) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-72 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
      <div className="h-96 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
    </div>
  );

  return (
    <div className="space-y-6">
      <BusinessIdentityForm country={country} onCountryChange={setCountry} />
      <CarrierNetworkForm country={country} />
    </div>
  );
}

// ── Business identity form ───────────────────────────────────────────────────

function BusinessIdentityForm({ country, onCountryChange }: {
  country: string;
  onCountryChange: (c: string) => void;
}) {
  const [form, setForm]       = useState<Partial<OrgSettings>>({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loaded, setLoaded]   = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    orgSettingsApi.get().then((s) => {
      setForm(s ?? {});
      if (s?.logo_url) setLogoPreview(s.logo_url);
      setLoaded(true);
    });
  }, []);

  function setField(k: keyof OrgSettings, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await resizeLogo(file);
    setLogoPreview(b64);
    setField("logo_url", b64);
  }

  function handleCountryChange(c: string) {
    setField("country", c);
    onCountryChange(c);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      await orgSettingsApi.update(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  if (!loaded) return <div className="h-72 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />;

  return (
    <form onSubmit={handleSave}>
      <SectionCard
        icon={<Building2 className="h-4 w-4 text-stone-400" />}
        title="Business identity"
        description="How your company appears on waybills, receipts, and the carrier directory."
      >
        {/* Logo uploader */}
        <div className="mb-5">
          <label className={labelCls}>Logo</label>
          <p className={hintCls}>Shown on waybill PDFs and your carrier directory listing.</p>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="h-16 w-16 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center overflow-hidden">
                {logoPreview
                  ? <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                  : <Truck className="h-7 w-7 text-stone-600" />}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full border border-white/[0.12] bg-[#0a1220] flex items-center justify-center text-stone-400 hover:text-white hover:border-orange-500/40 transition-colors"
                title="Upload logo"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>
            <div className="text-xs text-stone-500 leading-relaxed">
              <p>Click the pencil to upload.</p>
              <p>PNG, JPG or SVG · max 2 MB</p>
              {logoPreview && (
                <button
                  type="button"
                  onClick={() => { setLogoPreview(""); setField("logo_url", ""); }}
                  className="mt-1 text-red-400/70 hover:text-red-400 transition-colors"
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Business name + city */}
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

        {/* Country */}
        <div className="mb-4">
          <label className={labelCls}>Country</label>
          <p className={hintCls}>Determines ID scheme, phone dial code, and default currency across the platform.</p>
          <CountryDropdown value={form.country ?? "ng"} onChange={handleCountryChange} />
        </div>

        {/* Phone + website */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className={labelCls}><span className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" /> Contact phone</span></label>
            <p className={hintCls}>WhatsApp or business line for carrier enquiries.</p>
            <input type="tel" value={form.contact_phone ?? ""} onChange={(e) => setField("contact_phone", e.target.value)} placeholder={COUNTRY_PHONE_CONFIGS[country]?.dialCode + " 800 000 0000"} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}><span className="inline-flex items-center gap-1.5"><Link2 className="h-3 w-3" /> Website</span></label>
            <p className={hintCls}>Public-facing website or booking page.</p>
            <input type="url" value={form.website_url ?? ""} onChange={(e) => setField("website_url", e.target.value)} placeholder="https://yourcompany.com" className={inputCls} />
          </div>
        </div>

        <SaveRow saving={saving} saved={saved} label="Save business info" />
      </SectionCard>
    </form>
  );
}

// ── Carrier network form ─────────────────────────────────────────────────────

const CAPACITY_OPTIONS: { value: CapacityType; label: string }[] = [
  { value: "motorcycle", label: "Motorcycle" },
  { value: "van",        label: "Van"        },
  { value: "truck",      label: "Truck"      },
  { value: "fleet",      label: "Fleet"      },
];

const PRICING_OPTIONS: { value: PricingModel; label: string; description: string }[] = [
  { value: "per_shipment", label: "Per shipment", description: "Flat rate per job"  },
  { value: "per_km",       label: "Per km",       description: "Rate per kilometre" },
  { value: "quoted",       label: "Quoted",       description: "Price on request"   },
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

const EMPTY_AREA = (country: string): ServiceArea => ({ city: "", state: "", country });

function ServiceAreaRow({ area, index, defaultCountry, onChange, onRemove }: {
  area: ServiceArea;
  index: number;
  defaultCountry: string;
  onChange: (i: number, field: keyof ServiceArea, value: string) => void;
  onRemove: (i: number) => void;
}) {
  const rowCountry = area.country || defaultCountry;
  const states = COUNTRY_STATES[rowCountry] ?? [];

  return (
    <div className="flex items-center gap-2">
      <input
        placeholder="City"
        value={area.city}
        onChange={(e) => onChange(index, "city", e.target.value)}
        className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none"
      />
      {states.length > 0 ? (
        <select
          value={area.state}
          onChange={(e) => onChange(index, "state", e.target.value)}
          className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none bg-[#0a1220]"
        >
          <option value="" className="bg-[#0c1522]">State / Region</option>
          {states.map((s) => <option key={s} value={s} className="bg-[#0c1522]">{s}</option>)}
        </select>
      ) : (
        <input
          placeholder="State"
          value={area.state}
          onChange={(e) => onChange(index, "state", e.target.value)}
          className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none"
        />
      )}
      <CountryDropdownCompact
        value={rowCountry}
        onChange={(v) => onChange(index, "country", v)}
        className="w-28"
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

function CarrierNetworkForm({ country }: { country: string }) {
  const [profile, setProfile]                 = useState<CarrierProfile | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [saving, setSaving]                   = useState(false);
  const [toggling, setToggling]               = useState(false);
  const [saved, setSaved]                     = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [capacityType, setCapacityType]       = useState<CapacityType>("van");
  const [serviceAreas, setServiceAreas]       = useState<ServiceArea[]>([EMPTY_AREA(country)]);
  const [pricingModel, setPricingModel]       = useState<PricingModel>("quoted");
  const [baseRate, setBaseRate]               = useState("");
  const [bio, setBio]                         = useState("");
  const [fleetSize, setFleetSize]             = useState("");
  const [specializations, setSpecializations] = useState<string[]>([]);

  const currency = countryCurrency(country);

  useEffect(() => {
    carrierApi.getProfile().then((p) => {
      if (p) {
        setProfile(p);
        setCapacityType(p.capacityType);
        setServiceAreas(p.serviceAreas.length > 0 ? p.serviceAreas : [EMPTY_AREA(country)]);
        setPricingModel(p.pricingModel);
        setBaseRate(p.baseRate > 0 ? String(p.baseRate / 100) : "");
        setBio(p.bio || "");
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAreaChange(i: number, field: keyof ServiceArea, value: string) {
    setServiceAreas((prev) => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  }

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
              {profile.isPublished
                ? <><EyeOff className="h-3.5 w-3.5" /> Unpublish</>
                : <><Eye className="h-3.5 w-3.5" /> Publish</>}
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
            <input type="number" min="1" value={fleetSize} onChange={(e) => setFleetSize(e.target.value)} placeholder="e.g. 12" className={`${inputCls} max-w-xs`} />
            <span className="text-xs text-stone-500">vehicles</span>
          </div>
        </div>

        {/* Service areas */}
        <div className="mb-4">
          <label className={labelCls}>Service areas</label>
          <p className={hintCls}>Cities and states your operation covers. State options update with the selected country.</p>
          <div className="space-y-2 mb-2">
            {serviceAreas.map((area, i) => (
              <ServiceAreaRow
                key={i}
                area={area}
                index={i}
                defaultCountry={country}
                onChange={handleAreaChange}
                onRemove={(idx) => setServiceAreas((prev) => prev.filter((_, j) => j !== idx))}
              />
            ))}
          </div>
          <button type="button" onClick={() => setServiceAreas((prev) => [...prev, EMPTY_AREA(country)])}
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
                className={["rounded-lg p-3 text-left transition-colors",
                  pricingModel === opt.value ? "bg-orange-500/[0.1] ring-1 ring-orange-500/30" : "bg-white/[0.04] hover:bg-white/[0.06]",
                ].join(" ")}>
                <p className={`text-xs font-medium ${pricingModel === opt.value ? "text-orange-400" : "text-stone-300"}`}>{opt.label}</p>
                <p className="text-[11px] text-stone-600 mt-0.5">{opt.description}</p>
              </button>
            ))}
          </div>
          {pricingModel !== "quoted" && (
            <div className="flex gap-2 items-center">
              <input type="number" min="0" step="0.01" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} placeholder="0.00"
                className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none" />
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 h-10 shrink-0">
                <FlagImg code={country} />
                <span className="text-xs font-semibold text-stone-300">{currency}</span>
              </div>
            </div>
          )}
        </div>

        {/* Bio */}
        <div className="mb-5">
          <label className={labelCls}>About your operation</label>
          <p className={hintCls}>Briefly describe your specialisation, coverage, or what sets you apart.</p>
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
  const [form, setForm]     = useState<Partial<OrgSettings>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    orgSettingsApi.get().then((s) => {
      setForm(s ?? {});
      setLoaded(true);
    });
  }, []);

  function setField(k: keyof OrgSettings, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      await orgSettingsApi.update(form);
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
