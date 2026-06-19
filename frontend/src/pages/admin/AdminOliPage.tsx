import { useEffect, useState } from "react";
import {
  Loader2, CheckCircle2, Key, Plug, RefreshCw, AlertCircle, Clock, Copy, Check,
} from "lucide-react";
import { orgOliApi, type OrgOliStatus } from "@/services/admin.api";
import { triggerWalletRefresh } from "@/components/layout/WalletWidget";

const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-10 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors font-mono";
const labelCls = "block text-xs font-medium text-stone-300 mb-1";
const hintCls  = "text-[11px] text-stone-600 mb-1.5";

export default function AdminOliPage() {
  const [status, setStatus] = useState<OrgOliStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopyId() {
    const id = status?.operatorId;
    if (!id) return;
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    orgOliApi.get()
      .then(setStatus)
      .catch(() => setStatus({ status: "not_provisioned", hasApiKey: false }))
      .finally(() => setLoading(false));
  }, []);

  const connected = status?.status === "active" && status?.hasApiKey;
  const pending = !connected;

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await orgOliApi.saveApiKey(apiKeyInput.trim());
      setStatus(updated);
      setApiKeyInput("");
      setSaved(true);
      triggerWalletRefresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Failed to save API key.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRotate() {
    setRotating(true);
    try {
      const updated = await orgOliApi.rotateSwitchKey();
      setStatus(updated);
      triggerWalletRefresh();
      setConfirmRotate(false);
      setRotated(true);
      setTimeout(() => setRotated(false), 4000);
    } catch {
      // handled inline
    } finally {
      setRotating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4 animate-pulse">
        <div className="h-4 w-40 rounded bg-muted/60" />
        <div className="h-48 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-base font-semibold">OLI Network Connection</h2>
        <p className="text-sm text-muted-foreground">
          Connect your organisation to the OLI custody network. All operators on this instance share this connection.
        </p>
      </div>

      <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
        <header className="flex items-start gap-3 px-5 py-4 border-b border-white/[0.06]">
          <div className="h-8 w-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
            <Plug className="h-4 w-4 text-stone-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white">Organisation API key</h3>
              {connected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/[0.1] border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </span>
              )}
              {pending && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/[0.1] border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                  <Clock className="h-3 w-3" /> Not connected
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5">
              This key authenticates all waybill, handover, and wallet operations for your entire organisation.
            </p>
          </div>
        </header>

        <div className="p-5 space-y-4">
          {connected && !confirmRotate && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3">
                <Key className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-stone-300">
                  <p className="font-medium text-emerald-300">API key active</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    All operators on this instance are connected to the OLI network.
                  </p>
                </div>
              </div>

              {status?.operatorId && (
                <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-600 mb-1">Operator ID</p>
                    <p className="text-xs font-mono text-stone-300 truncate">{status.operatorId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    title="Copy operator ID"
                    className="ml-3 shrink-0 flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-stone-500 hover:text-stone-200 transition-colors"
                  >
                    {copied
                      ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                      : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}

              {rotated && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-xs text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Key rotated on the OLI network and saved. New key emailed to you.
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-300">Rotate API key</p>
                  <p className="text-[11px] text-stone-500 mt-0.5 max-w-md">
                    Generates a new key on the OLI Switch and saves it here automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmRotate(true)}
                  className="shrink-0 ml-3 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:border-red-500/30 hover:text-red-300 px-3 h-9 text-xs font-medium text-stone-300 transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Rotate
                </button>
              </div>
            </>
          )}

          {connected && confirmRotate && (
            <div className="rounded-lg border border-red-500/25 bg-red-500/[0.06] p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-300">Rotate organisation API key?</p>
                  <p className="text-xs text-red-400/80 mt-1 leading-relaxed">
                    A new key is issued on the OLI Switch, your old key is immediately invalidated, and the new key is saved here automatically.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRotate}
                  disabled={rotating}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3.5 h-9 text-xs font-semibold disabled:opacity-60 transition-colors"
                >
                  {rotating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Rotating...</> : <><RefreshCw className="h-3.5 w-3.5" /> Yes, rotate</>}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRotate(false)}
                  disabled={rotating}
                  className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] px-3.5 h-9 text-xs font-medium text-stone-400 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {pending && (
            <form onSubmit={handleSaveKey} className="space-y-3">
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5"><Key className="h-3 w-3" /> API key</span>
                </label>
                <p className={hintCls}>Paste the API key for your organisation's OLI operator account.</p>
                <input
                  type="text"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Paste your OLI API key"
                  className={inputCls}
                />
              </div>

              {error && (
                <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving || apiKeyInput.trim().length < 10}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-4 h-10 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 disabled:opacity-60 transition-all"
                >
                  {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting...</> : "Connect"}
                </button>
                {saved && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                  </span>
                )}
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
