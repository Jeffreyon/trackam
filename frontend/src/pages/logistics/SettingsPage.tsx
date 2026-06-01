import { useEffect, useState } from "react";
import {
  Loader2, CheckCircle2, Key, Building2, Fuel, AlertTriangle,
  Globe, Plug, RefreshCw, AlertCircle, Clock,
} from "lucide-react";
import { logisticsSettingsApi, type LogisticsSettings } from "@/services/logistics";
import { oliAccountApi, type OliAccount } from "@/services/oliAccount";
import { triggerWalletRefresh } from "@/components/layout/WalletWidget";
import { COUNTRY_OPTIONS } from "@/lib/idSchemes";

const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-10 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors";

const labelCls = "block text-xs font-medium text-stone-300 mb-1";
const hintCls  = "text-[11px] text-stone-600 mb-1.5";

export default function SettingsPage() {
  const [settings, setSettings] = useState<LogisticsSettings | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [oliAccount, setOliAccount] = useState<OliAccount | null>(null);

  useEffect(() => {
    logisticsSettingsApi.get().then((s) => {
      setSettings(s);
      setForm(s as unknown as Record<string, string>);
    });
    oliAccountApi.get().then(setOliAccount).catch(() => {});
  }, []);

  function setField(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
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
    return <SettingsSkeleton />;
  }

  return (
    <div className="max-w-3xl space-y-5">
      <form onSubmit={handleSave} className="space-y-5">

        {/* Business */}
        <SectionCard
          icon={<Building2 className="h-4 w-4 text-stone-400" />}
          title="Business"
          description="How your business appears on documents and where you operate."
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
              <p className={hintCls}>Your primary base of operations.</p>
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
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> Country
              </span>
            </label>
            <p className={hintCls}>Determines the government ID scheme used on handover scan pages and the dial code for phone fields.</p>
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
          description="How Trackam estimates the fuel cost of a run from its distance."
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
                <span className="text-xs text-stone-500 shrink-0">₦/L</span>
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

          <FormulaPreview
            fuelPrice={parseFloat(form.fuel_price_per_litre || "0")}
            fuelEff={parseFloat(form.fuel_efficiency_multiplier || "0")}
          />
        </SectionCard>

        {/* Alerts */}
        <SectionCard
          icon={<AlertTriangle className="h-4 w-4 text-stone-400" />}
          title="Alerts"
          description="When to flag runs as at risk so they surface on your dashboard."
        >
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Ghost threshold
              </span>
            </label>
            <p className={hintCls}>Hours without a status update before a run is flagged as ghosting risk.</p>
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

        {/* Sticky save bar at the bottom of the form */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-5 h-10 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-60 transition-all"
          >
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              : "Save settings"}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
        </div>
      </form>

      {/* Network connection — separate card with its own actions */}
      {oliAccount && (
        <NetworkConnectionCard account={oliAccount} onChange={setOliAccount} />
      )}
    </div>
  );
}

// ── Sections ───────────────────────────────────────────────────────────────

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

function FormulaPreview({ fuelPrice, fuelEff }: { fuelPrice: number; fuelEff: number }) {
  const cost100km = Math.round(fuelPrice * fuelEff * 100);
  return (
    <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1">Formula</p>
      <p className="text-xs text-stone-400 font-mono">
        fuel_cost = distance_km × fuel_efficiency × fuel_price
      </p>
      <p className="text-[11px] text-stone-500 mt-1.5">
        At ₦{fuelPrice.toLocaleString("en-NG")}/L × {fuelEff} L/km — a 100km run costs ~
        <span className="font-semibold text-orange-400 ml-0.5">₦{cost100km.toLocaleString("en-NG")}</span> in fuel.
      </p>
    </div>
  );
}

// ── Network connection card ────────────────────────────────────────────────

function NetworkConnectionCard({
  account, onChange,
}: {
  account: OliAccount;
  onChange: (a: OliAccount) => void;
}) {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

  const connected = account.status === "active" && account.hasApiKey;
  const pending   = account.status === "pending" || account.status === "not_provisioned";

  async function handleSaveApiKey(e: React.FormEvent) {
    e.preventDefault();
    setSavingKey(true);
    setKeyError(null);
    setKeySaved(false);
    try {
      const updated = await oliAccountApi.saveApiKey(apiKeyInput.trim());
      onChange(updated);
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

  async function handleRotate() {
    setRotating(true);
    setRotateError(null);
    try {
      const updated = await oliAccountApi.rotateApiKey();
      onChange(updated);
      triggerWalletRefresh();
      setConfirmRotate(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setRotateError(msg || "Failed to rotate API key. Please try again.");
    } finally {
      setRotating(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
      <header className="flex items-start gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="h-8 w-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
          <Plug className="h-4 w-4 text-stone-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-white">Network connection</h2>
            {connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/[0.1] border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            )}
            {pending && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/[0.1] border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                <Clock className="h-3 w-3" /> Pending approval
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Connects your Trackam backend to the custody network for waybill signing, handovers, and wallet.
          </p>
        </div>
      </header>

      <div className="p-5 space-y-4">

        {/* Connected — show rotate option */}
        {connected && !confirmRotate && (
          <>
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3">
              <Key className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-stone-300 flex-1 min-w-0">
                <p className="font-medium text-emerald-300">API key active</p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Waybill signing, handovers, and wallet are all live.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-stone-300">Rotate API key</p>
                <p className="text-[11px] text-stone-500 mt-0.5 max-w-md">
                  If your key has been exposed or you're moving to a new environment, request a fresh one.
                  This disconnects your dashboard until a new key arrives by email.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmRotate(true)}
                className="shrink-0 ml-3 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:border-red-500/30 hover:text-red-300 px-3 h-9 text-xs font-medium text-stone-300 transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Rotate key
              </button>
            </div>
          </>
        )}

        {/* Rotate confirmation */}
        {connected && confirmRotate && (
          <div className="rounded-lg border border-red-500/25 bg-red-500/[0.06] p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-300">Rotate your API key?</p>
                <p className="text-xs text-red-400/80 mt-1 leading-relaxed">
                  Your current key will be cleared immediately. Handovers and waybill signing will stop working
                  until a new key is sent to your email and you paste it here. Continue?
                </p>
              </div>
            </div>
            {rotateError && (
              <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{rotateError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRotate}
                disabled={rotating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3.5 h-9 text-xs font-semibold disabled:opacity-60 transition-colors"
              >
                {rotating
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Rotating…</>
                  : <><RefreshCw className="h-3.5 w-3.5" /> Yes, rotate key</>}
              </button>
              <button
                type="button"
                onClick={() => { setConfirmRotate(false); setRotateError(null); }}
                disabled={rotating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] px-3.5 h-9 text-xs font-medium text-stone-400 hover:text-white disabled:opacity-60 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Pending — show API key entry */}
        {pending && (
          <>
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3">
              <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-stone-300 flex-1 min-w-0">
                <p className="font-medium text-amber-300">Your account is awaiting approval</p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Once activated, you'll receive an API key by email. Paste it below to connect your dashboard.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveApiKey} className="space-y-3">
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <Key className="h-3 w-3" /> API key
                  </span>
                </label>
                <p className={hintCls}>The key emailed to you when your account is activated.</p>
                <input
                  type="text"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Paste your Trackam API key here"
                  className={`${inputCls} font-mono`}
                />
              </div>

              {keyError && (
                <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{keyError}
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={savingKey || apiKeyInput.trim().length < 10}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-4 h-10 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-60 transition-all"
                >
                  {savingKey
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting…</>
                    : "Connect"}
                </button>
                {keySaved && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                  </span>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

function SettingsSkeleton() {
  return (
    <div className="max-w-3xl space-y-5 animate-pulse">
      <div className="h-44 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
      <div className="h-44 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
      <div className="h-28 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
      <div className="h-10 w-32 rounded-lg bg-white/[0.03] border border-white/[0.06]" />
      <div className="h-44 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
    </div>
  );
}
