import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Wallet } from "lucide-react";
import { walletApi, type WalletData } from "@/services/handover";
import { formatNairaRaw } from "@/lib/format";
import { useProfileStore } from "@/hooks/useProfile";
import { WalletModal } from "./WalletModal";

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
  const [open, setOpen] = useState(false);

  // Top-up modal is ONLY available from the admin dashboard, and only for
  // owners. The operator dashboard always shows a read-only chip — even for
  // owners — so the wallet feels like an org-level resource managed in the
  // admin section. The chip stays visible everywhere so any operator knows
  // the org has credit to do handovers.
  const location = useLocation();
  const onAdminDashboard = location.pathname.startsWith("/admin");
  const roles = useProfileStore((s) => (s.profile?.roles as string[] | undefined) ?? []);
  const isOwner = roles.includes("owner") || roles.includes("admin");
  const canOpenModal = onAdminDashboard && isOwner;

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
      <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 h-8 animate-pulse">
        <Wallet className="h-3.5 w-3.5 text-stone-600 shrink-0" />
        <span className="block w-14 h-2.5 rounded bg-white/[0.08]" />
      </div>
    );
  }

  // No wallet data — show faded placeholder (not clickable)
  if (unavailable || !wallet) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 h-8 opacity-40"
        title="Connect your OLI API key in Settings to view your wallet balance"
      >
        <Wallet className="h-3.5 w-3.5 text-stone-500 shrink-0" />
        <span className="text-xs font-medium text-stone-500 tabular-nums">&mdash;</span>
      </div>
    );
  }

  // Not in admin context, or not an owner → read-only chip.
  // Still shows the balance so any operator knows handovers will succeed.
  if (!canOpenModal) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 h-8"
        title={isOwner
          ? "Organisation wallet — open the admin dashboard to top up"
          : "Organisation wallet balance — contact your admin to top up"}
      >
        <Wallet className="h-3.5 w-3.5 text-orange-400/70 shrink-0" />
        <span className="text-xs font-medium text-stone-300 tabular-nums">
          {formatNairaRaw(wallet.balance)}
        </span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] hover:border-orange-500/20 px-2.5 h-8 transition-colors group"
        aria-label="Open wallet"
        title="Open wallet"
      >
        <Wallet className="h-3.5 w-3.5 text-orange-400/70 shrink-0 group-hover:text-orange-400 transition-colors" />
        <span className="text-xs font-medium text-stone-300 tabular-nums group-hover:text-white transition-colors">
          {formatNairaRaw(wallet.balance)}
        </span>
      </button>

      {open && (
        <WalletModal
          wallet={wallet}
          onClose={() => setOpen(false)}
          onRefresh={() => load(true)}
          refreshing={refreshing}
        />
      )}
    </>
  );
}
