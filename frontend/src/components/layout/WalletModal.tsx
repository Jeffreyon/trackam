import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { Wallet, RefreshCw, X, ArrowRight, Receipt, Loader2, AlertCircle, Plus } from "lucide-react";
import { walletApi, type WalletData } from "@/services/handover";
import { formatNaira, formatNairaRaw } from "@/lib/format";

interface Props {
  wallet: WalletData | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
}

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000];

export function WalletModal({ wallet, onClose, onRefresh, refreshing }: Props) {
  const [amount, setAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const isAdminContext = location.pathname.startsWith("/admin");
  const transactionsPath = isAdminContext ? "/admin/dashboard/wallet" : "/dashboard/wallet/transactions";

  // Close on Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault();
    const ngn = parseInt(amount, 10);
    if (!ngn || ngn < 100) {
      setError("Minimum top-up amount is ₦100.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await walletApi.topup(ngn);
      // Redirect to Paystack's hosted payment page
      window.location.href = result.authorization_url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Could not start top-up. Please try again.");
      setSubmitting(false);
    }
  }

  // Render to document.body so the modal escapes the dashboard header's
  // backdrop-blur stacking context (which otherwise traps position: fixed).
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Wallet"
        className="relative w-full max-w-md rounded-xl bg-[#0c1522] shadow-2xl shadow-black/50 border border-white/[0.08] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">OLI Switch wallet</p>
              <p className="text-[11px] text-stone-500">Used for handover and waybill fees</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-600 hover:text-stone-300 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Balance */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">Balance</p>
            <button
              onClick={() => onRefresh()}
              disabled={refreshing}
              className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-300 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={["h-3 w-3", refreshing ? "animate-spin" : ""].join(" ")} />
              Refresh
            </button>
          </div>
          <p className="text-3xl font-bold text-white tabular-nums mt-1.5">
            {wallet
              ? <>₦<span className="ml-0.5">{formatNairaRaw(wallet.balance).replace(/^₦/, "")}</span></>
              : "—"}
          </p>
          {wallet && (
            <p className="text-[11px] text-stone-600 mt-1">
              Last updated {new Date(wallet.updated_at).toLocaleString("en-NG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* Top-up form */}
        <form onSubmit={handleTopup} className="px-5 pb-5 space-y-3 border-t border-white/[0.06] pt-4">
          <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">Top up</p>

          <div className="grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmount(String(amt))}
                className={[
                  "rounded-lg border h-9 text-xs font-medium transition-all",
                  amount === String(amt)
                    ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
                    : "border-white/[0.08] bg-white/[0.03] text-stone-400 hover:text-white hover:bg-white/[0.06]",
                ].join(" ")}
              >
                {formatNaira(amt * 100)}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-stone-500 mb-1">Custom amount (₦)</label>
            <input
              type="number"
              inputMode="numeric"
              min={100}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(""); }}
              placeholder="e.g. 15000"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-10 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors tabular-nums"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !amount}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 h-10 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-60 transition-all"
          >
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting to Paystack…</>
              : <><Plus className="h-4 w-4" /> Top up wallet</>}
          </button>

          <Link
            to={transactionsPath}
            onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] h-10 text-xs font-medium text-stone-300 hover:text-white transition-all"
          >
            <Receipt className="h-3.5 w-3.5" /> View transactions <ArrowRight className="h-3 w-3" />
          </Link>
        </form>
      </div>
    </div>,
    document.body
  );
}
