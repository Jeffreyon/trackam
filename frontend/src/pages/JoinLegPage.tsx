/**
 * Legacy URL-share join leg page — kept as a fallback for SMS / WhatsApp
 * links that already exist in the wild. The preferred flow is now the
 * JoinLegModal opened from inside the dashboard ("Join a leg" button).
 *
 * Migrated to the dark theme so it stops looking like a different product.
 */

import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Loader2, ShieldCheck, MapPin, Package, CheckCircle2, AlertTriangle, ArrowRight,
} from "lucide-react";
import {
  publicHandoverApi, waybillApi,
  ACTOR_LABELS, type TokenInfo,
} from "@/services/handover";
import { useProfileStore } from "@/hooks/useProfile";
import { getAuthToken } from "@/lib/authToken";
import { PublicNav } from "@/components/layout/PublicNav";

type Phase = "loading" | "preview" | "joining" | "success" | "error" | "needs-verification";

export default function JoinLegPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const profile = useProfileStore((s) => s.profile);

  const [phase, setPhase] = useState<Phase>("loading");
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [error, setError] = useState("");
  const [joinedShipmentId, setJoinedShipmentId] = useState<string | null>(null);
  const [verificationState, setVerificationState] = useState<string | null>(null);

  const isSignedIn = Boolean(getAuthToken());

  useEffect(() => {
    if (!token) {
      setError("No handover token in this link.");
      setPhase("error");
      return;
    }
    if (!isSignedIn) {
      const returnUrl = `/join?token=${encodeURIComponent(token)}`;
      navigate(`/auth/login?redirect=${encodeURIComponent(returnUrl)}`, { replace: true });
      return;
    }
    publicHandoverApi.getTokenInfo(token)
      .then((info) => {
        setTokenInfo(info);
        setPhase("preview");
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || "Invalid or expired handover token.";
        setError(msg);
        setPhase("error");
      });
  }, [token, isSignedIn]);

  async function handleJoinLeg() {
    if (!token || !tokenInfo) return;
    setPhase("joining");
    try {
      const displayName = (profile as { displayName?: string; email?: string } | null)?.displayName
        || (profile as { email?: string } | null)?.email
        || "Operator";
      const result = await waybillApi.confirmAndJoin(token, displayName);
      setJoinedShipmentId(result.shipmentId);
      setPhase("success");
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { message?: string; verificationState?: string } } })?.response;
      const msg = resp?.data?.message
        || (err as Error)?.message
        || "Failed to join custody leg.";
      // 403 with verificationState means the staff user isn't approved yet.
      if (resp?.status === 403 && resp?.data?.verificationState) {
        setVerificationState(resp.data.verificationState);
        setError(msg);
        setPhase("needs-verification");
        return;
      }
      setError(msg);
      setPhase("error");
    }
  }

  return (
    <div className="min-h-screen bg-[#060d18] text-white flex flex-col">
      <PublicNav />
      <main className="flex-1 flex items-center justify-center px-4 pt-24 pb-12">
        <div className="w-full max-w-sm">

          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
              <p className="text-sm text-stone-400">Loading handover details…</p>
            </div>
          )}

          {phase === "preview" && tokenInfo && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-purple-500/15 flex items-center justify-center mb-3">
                  <Package className="h-6 w-6 text-purple-400" />
                </div>
                <h1 className="text-lg font-semibold text-white">Join custody leg</h1>
                <p className="text-sm text-stone-400 mt-1">
                  A driver is handing this shipment to your hub.
                </p>
              </div>

              <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-4 space-y-2.5">
                <p className="text-sm font-medium text-purple-200">{tokenInfo.shipment.goodsDescription}</p>
                <p className="text-xs text-purple-400/80 flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {tokenInfo.shipment.pickupLocation} → {tokenInfo.shipment.deliveryLocation}
                </p>
                <div className="border-t border-purple-500/20 pt-2.5 flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                  <span className="text-xs text-purple-400/80">
                    From: <span className="text-purple-200 font-medium">{tokenInfo.giverName || "Driver"}</span> ({ACTOR_LABELS[tokenInfo.giverActorType]})
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3">
                <p className="text-xs text-amber-300 leading-relaxed">
                  Accepting will create a shipment on your dashboard and record a proof-of-handover on the network.
                </p>
              </div>

              <button
                onClick={handleJoinLeg}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 h-11 text-sm font-semibold text-white shadow-sm shadow-purple-500/20 transition-all"
              >
                <ShieldCheck className="h-4 w-4" />
                Accept custody & join leg
              </button>
            </div>
          )}

          {phase === "joining" && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-7 w-7 animate-spin text-purple-400" />
              <p className="text-sm text-stone-300">Recording handover…</p>
              <p className="text-[11px] text-stone-500">Don't close this window.</p>
            </div>
          )}

          {phase === "success" && (
            <div className="flex flex-col items-center text-center gap-5 py-8">
              <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">Custody received</p>
                <p className="text-sm text-stone-400 mt-1">
                  The shipment has been added to your dashboard.
                </p>
              </div>
              <button
                onClick={() => navigate(joinedShipmentId ? `/dashboard/shipments/${joinedShipmentId}` : "/dashboard/waybills")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 px-4 h-10 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition-all"
              >
                View shipment <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {phase === "needs-verification" && (
            <div className="flex flex-col items-center text-center gap-4 py-8">
              <div className="h-14 w-14 rounded-full bg-amber-500/15 flex items-center justify-center">
                <ShieldCheck className="h-7 w-7 text-amber-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">Your ID isn't verified yet</p>
                <p className="text-sm text-stone-400 mt-1 max-w-xs">{error}</p>
                {verificationState === "missing" && (
                  <p className="text-xs text-stone-500 mt-2 max-w-xs">
                    Upload your government ID from the Account page, then ask your admin to approve it.
                  </p>
                )}
                {verificationState === "pending" && (
                  <p className="text-xs text-stone-500 mt-2 max-w-xs">
                    Your ID is in the queue. Ping your admin to review it.
                  </p>
                )}
                {verificationState === "rejected" && (
                  <p className="text-xs text-stone-500 mt-2 max-w-xs">
                    Your last submission was rejected. Re-upload from your Account page.
                  </p>
                )}
              </div>
              <button
                onClick={() => navigate("/dashboard/account")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 px-4 h-10 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition-all"
              >
                Go to Account
              </button>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center text-center gap-4 py-8">
              <div className="h-14 w-14 rounded-full bg-red-500/15 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-red-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">Something went wrong</p>
                <p className="text-sm text-stone-400 mt-1 max-w-xs">{error}</p>
              </div>
              <button
                onClick={() => navigate("/dashboard/waybills")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] px-4 h-10 text-sm font-medium text-stone-300 hover:text-white transition-all"
              >
                Go to dashboard
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
