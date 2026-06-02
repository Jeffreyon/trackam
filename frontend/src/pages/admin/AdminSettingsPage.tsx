import { useEffect, useState } from "react";
import {
  Loader2, CheckCircle2, Building2, Fuel, AlertTriangle, Globe, Clock,
} from "lucide-react";
import { orgSettingsApi, type OrgSettings } from "@/services/admin.api";
import { COUNTRY_OPTIONS } from "@/lib/idSchemes";

const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-10 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors";
const labelCls = "block text-xs font-medium text-stone-300 mb-1";
const hintCls  = "text-[11px] text-stone-600 mb-1.5";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    orgSettingsApi.get().then((s) => {
      setSettings(s);
      setForm(s as unknown as Record<string, string>);
    });
  }, []);

  function setField(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const updated = await orgSettingsApi.update(form as unknown as Partial<OrgSettings>);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="max-w-3xl space-y-5 animate-pulse">
        <div className="h-4 w-40 rounded bg-muted/60" />
        <div className="h-44 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
        <div className="h-44 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
        <div className="h-28 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-base font-semibold">Organisation Settings</h2>
        <p className="text-sm text-muted-foreground">
          These settings apply to all operators on this instance.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Business */}
        <SectionCard
          icon={<Building2 className="h-4 w-4 text-stone-400" />}
          title="Business"
          description="How your logistics company appears on documents."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Business name</label>
              <p className={hintCls}>Your trading or company name.</p>
              <input
                type="text"
                value={form.business_name ?? ""}
                onChange={(e) => setField("business_name", e.target.value)}
                placeholder="e.g. Redstar Logistics"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Business city</label>
              <p className={hintCls}>Primary base of operations.</p>
              <input
                type="text"
                value={form.business_city ?? ""}
                onChange={(e) => setField("business_city", e.target.value)}
                placeholder="e.g. Lagos"
                className={inputCls}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1.5"><Globe className="h-3 w-3" /> Country</span>
            </label>
            <p className={hintCls}>Determines ID scheme and phone dial code across the platform.</p>
            <select
              value={form.country ?? ""}
              onChange={(e) => setField("country", e.target.value)}
              className={inputCls}
            >
              {COUNTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0c1522]">{opt.label}</option>
              ))}
            </select>
          </div>
        </SectionCard>

        {/* Cost calculation */}
        <SectionCard
          icon={<Fuel className="h-4 w-4 text-stone-400" />}
          title="Cost calculation"
          description="How Trackam estimates fuel costs across all dispatch runs."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fuel price</label>
              <p className={hintCls}>Current petrol cost.</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={form.fuel_price_per_litre ?? ""}
                  onChange={(e) => setField("fuel_price_per_litre", e.target.value)}
                  className={inputCls}
                />
                <span className="text-xs text-stone-500 shrink-0">/L</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>Fuel efficiency</label>
              <p className={hintCls}>Litres consumed per km (default 0.12).</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={form.fuel_efficiency_multiplier ?? ""}
                  onChange={(e) => setField("fuel_efficiency_multiplier", e.target.value)}
                  className={inputCls}
                />
                <span className="text-xs text-stone-500 shrink-0">L/km</span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Alerts */}
        <SectionCard
          icon={<AlertTriangle className="h-4 w-4 text-stone-400" />}
          title="Alerts"
          description="When to flag runs as at risk across the organisation."
        >
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-3 w-3" /> Ghost threshold</span>
            </label>
            <p className={hintCls}>Hours without a status update before a run is flagged.</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={form.ghost_threshold_hours ?? ""}
                onChange={(e) => setField("ghost_threshold_hours", e.target.value)}
                className={`${inputCls} max-w-xs`}
              />
              <span className="text-xs text-stone-500">hours</span>
            </div>
          </div>
        </SectionCard>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-5 h-10 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 disabled:opacity-60 transition-all"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save settings"}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function SectionCard({
  icon, title, description, children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
      <header className="flex items-start gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="h-8 w-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="text-[11px] text-stone-500 mt-0.5">{description}</p>
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
