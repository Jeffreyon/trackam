import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Wallet, Loader2, ArrowUpRight, ArrowDownRight, RefreshCw, ExternalLink, CheckCircle2,
} from "lucide-react";
import { walletApi, type WalletData, type WalletTransaction } from "@/services/handover";
import { formatNaira, formatDateTime } from "@/lib/format";
import { triggerWalletRefresh } from "@/components/layout/WalletWidget";

export default function AdminWalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentSettled, setPaymentSettled] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [w, txns] = await Promise.all([
        walletApi.get(),
        walletApi.transactions().catch(() => []),
      ]);
      setWallet(w);
      setTransactions(txns);
      return w;
    } catch {
      return null;
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // When Paystack redirects back with ?reference=xxx, poll until the webhook credits the wallet.
  // After 3 polls with no change, call /topup/verify as a fallback (idempotent server-side verify).
  useEffect(() => {
    const ref = searchParams.get("reference");
    if (!ref) return;
    setSearchParams({}, { replace: true });
    setPaymentPending(true);
    triggerWalletRefresh();

    let attempts = 0;
    let settled = false;

    function settle() {
      if (settled) return;
      settled = true;
      clearInterval(pollRef.current!);
      load(true).then(() => triggerWalletRefresh());
      setPaymentPending(false);
      setPaymentSettled(true);
    }

    // Call verify immediately on return — idempotent, safe to call even if webhook already ran
    walletApi.verifyTopup(ref)
      .then((r) => { if (r.credited || r.wallet) settle(); })
      .catch(() => {});

    // Also poll so we catch it if webhook fires before verify responds
    pollRef.current = setInterval(async () => {
      attempts++;
      const txns = await walletApi.transactions().catch(() => []);
      if (txns.some((t: { reference: string }) => t.reference === ref) || attempts >= 10) {
        settle();
      }
    }, 2000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) return;
    setTopupLoading(true);
    try {
      const result = await walletApi.topup(amount);
      if (result.authorization_url) {
        window.open(result.authorization_url, "_blank");
      }
      setTopupAmount("");
      // Refresh after a short delay for the webhook to settle
      setTimeout(() => { load(true); triggerWalletRefresh(); }, 5000);
    } catch {
      // handled
    } finally {
      setTopupLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4 animate-pulse">
        <div className="h-4 w-32 rounded bg-muted/60" />
        <div className="h-32 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
        <div className="h-64 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="max-w-3xl space-y-4">
        <div>
          <h2 className="text-base font-semibold">Wallet</h2>
          <p className="text-sm text-muted-foreground">
            Connect your OLI API key first to view your organisation's wallet.
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center">
          <Wallet className="h-8 w-8 text-stone-600 mx-auto mb-3" />
          <p className="text-sm text-stone-500">No wallet data available</p>
          <p className="text-xs text-stone-600 mt-1">Set up your OLI connection in the Network tab first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Organisation Wallet</h2>
          <p className="text-sm text-muted-foreground">
            Credits fund handovers, waybill claims, and custody operations on the OLI network.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] px-3 h-8 text-xs font-medium text-stone-300 transition-all disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Payment return banners */}
      {paymentPending && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-300">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Payment received — waiting for confirmation from the network…
        </div>
      )}
      {paymentSettled && !paymentPending && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Wallet topped up successfully.
        </div>
      )}

      {/* Balance + top-up */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Balance</p>
          <p className="mt-2 text-3xl font-bold text-white tabular-nums">
            {formatNaira(wallet.balance)}
          </p>
          <p className="mt-1 text-[11px] text-stone-600">
            Updated {formatDateTime(wallet.updated_at)}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500 mb-3">Top up</p>
          <form onSubmit={handleTopup} className="flex items-end gap-2">
            <div className="flex-1">
              <input
                type="number"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="Amount (NGN)"
                min="100"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-10 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={topupLoading || !topupAmount || Number(topupAmount) <= 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-4 h-10 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 disabled:opacity-60 transition-all shrink-0"
            >
              {topupLoading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing...</>
                : <><ExternalLink className="h-3.5 w-3.5" /> Pay with Paystack</>}
            </button>
          </form>
          <p className="text-[11px] text-stone-600 mt-2">Opens Paystack checkout in a new tab.</p>
        </div>
      </div>

      {/* Transactions */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
        <header className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">Transaction history</h3>
          <p className="text-[11px] text-stone-500 mt-0.5">Recent credits and debits on the OLI network.</p>
        </header>

        {transactions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-stone-500">No transactions yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                  tx.type === "credit"
                    ? "bg-emerald-500/[0.1] text-emerald-400"
                    : "bg-red-500/[0.1] text-red-400"
                }`}>
                  {tx.type === "credit"
                    ? <ArrowDownRight className="h-3.5 w-3.5" />
                    : <ArrowUpRight className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-stone-300 truncate">
                    {tx.description || (tx.type === "credit" ? "Top-up" : "Debit")}
                  </p>
                  <p className="text-[11px] text-stone-600">{formatDateTime(tx.created_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-semibold tabular-nums ${
                    tx.type === "credit" ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {tx.type === "credit" ? "+" : "-"}{formatNaira(tx.amount)}
                  </p>
                  <p className="text-[10px] text-stone-600 tabular-nums">
                    bal: {formatNaira(tx.balance_after)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
