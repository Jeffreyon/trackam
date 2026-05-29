import { useEffect, useState, useCallback } from "react";
import { Wallet, RefreshCw } from "lucide-react";
import { walletApi, type WalletData } from "@/services/handover";
import { formatNaira } from "@/lib/format";

/** Dispatch this event from anywhere to make the wallet re-fetch. */
export const WALLET_REFRESH_EVENT = "trackam:wallet-refresh";

export function triggerWalletRefresh() {
  window.dispatchEvent(new CustomEvent(WALLET_REFRESH_EVENT));
}

export default function WalletWidget() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const w = await walletApi.get();
      setWallet(w);
      setUnavailable(false);
    } catch {
      // OLI switch unavailable or no API key configured
      setUnavailable(true);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Listen for refresh events (e.g. after API key is saved in Settings)
  useEffect(() => {
    function onRefresh() { load(true); }
    window.addEventListener(WALLET_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(WALLET_REFRESH_EVENT, onRefresh);
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 h-8 animate-pulse">
        <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="block w-14 h-2.5 rounded bg-muted-foreground/20" />
      </div>
    );
  }

  // No wallet data — show faded placeholder
  if (unavailable || !wallet) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 h-8 opacity-40"
        title="Connect your OLI API key in Settings to view your wallet balance"
      >
        <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground tabular-nums">—</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 h-8" title="OLI Switch wallet balance">
      <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs font-medium text-foreground tabular-nums">
        {formatNaira(wallet.balance)}
      </span>
      <button
        onClick={() => load(true)}
        disabled={refreshing}
        className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 ml-0.5"
        aria-label="Refresh wallet balance"
      >
        <RefreshCw className={["h-3 w-3", refreshing ? "animate-spin" : ""].join(" ")} />
      </button>
    </div>
  );
}
