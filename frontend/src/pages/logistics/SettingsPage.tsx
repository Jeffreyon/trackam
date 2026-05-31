import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Key } from "lucide-react";
import { logisticsSettingsApi, type LogisticsSettings } from "@/services/logistics";
import { oliAccountApi, type OliAccount } from "@/services/oliAccount";
import { triggerWalletRefresh } from "@/components/layout/WalletWidget";
import { COUNTRY_OPTIONS } from "@/lib/idSchemes";

const FIELDS: { key: keyof LogisticsSettings; label: string; description: string; suffix?: string; type?: string }[] = [
  { key: "business_name", label: "Business name", description: "Your trading or company name.", type: "text" },
  { key: "business_city", label: "Business city", description: "Your primary base of operations.", type: "text" },
  { key: "fuel_price_per_litre", label: "Fuel price", description: "Current petrol cost in ₦ per litre.", suffix: "₦/L", type: "number" },
  { key: "fuel_efficiency_multiplier", label: "Fuel efficiency", description: "Litres consumed per km (default: 0.12).", suffix: "L/km", type: "number" },
  { key: "ghost_threshold_hours", label: "Ghost threshold", description: "Hours without a status update before a shipment is flagged as ghosting risk.", suffix: "hours", type: "number" },
];

const SELECT_FIELDS: Record<string, { label: string; description: string; options: readonly { value: string; label: string }[] }> = {
  country: {
    label: "Country",
    description: "Determines the government ID scheme shown on handover scan pages.",
    options: COUNTRY_OPTIONS,
  },
};

const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors";

export default function SettingsPage() {
  const [settings, setSettings] = useState<LogisticsSettings | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [oliAccount, setOliAccount] = useState<OliAccount | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    logisticsSettingsApi.get().then((s) => {
      setSettings(s);
      setForm(s as unknown as Record<string, string>);
    });
    oliAccountApi.get().then(setOliAccount).catch(() => {});
  }, []);

  async function handleSaveApiKey(e: React.FormEvent) {
    e.preventDefault();
    setSavingKey(true);
    setKeyError(null);
    setKeySaved(false);
    try {
      const updated = await oliAccountApi.saveApiKey(apiKeyInput.trim());
      setOliAccount(updated);
      setApiKeyInput("");
      setKeySaved(true);
      triggerWalletRefresh();
      setTimeout(() => setKeySaved(false), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setKeyError(msg || "Failed to save API key. Check that the key is correct.");
    } finally {
      setSavingKey(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await logisticsSettingsApi.update(form as unknown as Partial<LogisticsSettings>);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <div className="animate-pulse h-64 max-w-lg rounded-lg bg-white/[0.03] border border-white/[0.06]" />;
  }

  return (
    <div className="max-w-lg">
      <form onSubmit={handleSave} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-6 space-y-5">
        {FIELDS.map(({ key, label, description, suffix, type = "text" }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-stone-300 mb-0.5">{label}</label>
            <p className="text-[11px] text-stone-600 mb-1.5">{description}</p>
            <div className="flex items-center gap-2">
              <input
                type={type}
                value={form[key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                step={key === "fuel_efficiency_multiplier" ? "0.01" : undefined}
                className={`flex-1 ${inputCls}`}
              />
              {suffix && <span className="text-xs text-stone-500 shrink-0">{suffix}</span>}
            </div>
          </div>
        ))}

        {Object.entries(SELECT_FIELDS).map(([key, { label, description, options }]) => (
          <div key={key}>
            <label className="block text-xs font-medium text-stone-300 mb-0.5">{label}</label>
            <p className="text-[11px] text-stone-600 mb-1.5">{description}</p>
            <select
              value={form[key] ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className={inputCls}
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0c1522]">{opt.label}</option>
              ))}
            </select>
          </div>
        ))}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-4 h-9 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-60 transition-all"
          >
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : "Save settings"}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
        </div>
      </form>

      <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3">
        <p className="text-[11px] text-stone-500">
          <strong className="text-stone-300">Fuel formula:</strong> fuel_cost = distance_km × fuel_efficiency × fuel_price_per_litre
        </p>
        <p className="text-[11px] text-stone-600 mt-1">
          At ₦{form.fuel_price_per_litre}/L × {form.fuel_efficiency_multiplier} L/km: a 100km trip costs ₦{(parseFloat(form.fuel_price_per_litre || "0") * parseFloat(form.fuel_efficiency_multiplier || "0") * 100).toLocaleString("en-NG")} in fuel.
        </p>
      </div>

      {/* OLI Switch API key */}
      {oliAccount && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Key className="h-4 w-4 text-stone-500" />
            <h2 className="text-sm font-semibold text-white">OLI Switch</h2>
            {oliAccount.status === "active" && oliAccount.hasApiKey && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/[0.1] border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            )}
            {(oliAccount.status === "pending" || oliAccount.status === "not_provisioned") && (
              <span className="inline-flex items-center rounded-full bg-amber-500/[0.1] border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                Pending approval
              </span>
            )}
          </div>

          {oliAccount.status === "active" && oliAccount.hasApiKey ? (
            <p className="text-xs text-stone-500">
              Your OLI Switch account is connected. Waybill signing, handovers, and custodian transfers are active.
            </p>
          ) : (
            <>
              <p className="text-xs text-stone-500 mb-3">
                {oliAccount.status === "pending" || oliAccount.status === "not_provisioned"
                  ? "Your account is awaiting approval. Once activated, you'll receive an API key by email. Paste it below."
                  : "Enter your OLI Switch API key to enable waybill signing and handover dispatch."}
              </p>
              <form onSubmit={handleSaveApiKey} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">API key</label>
                  <input
                    type="text"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Paste your OLI Switch API key here"
                    className={`${inputCls} font-mono`}
                  />
                </div>
                {keyError && (
                  <p className="text-xs text-red-400">{keyError}</p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingKey || apiKeyInput.trim().length < 10}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-4 h-9 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-60 transition-all"
                  >
                    {savingKey ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : "Save API key"}
                  </button>
                  {keySaved && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                    </span>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
