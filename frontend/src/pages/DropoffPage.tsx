import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle2, AlertCircle, Loader2, Package, ArrowRight,
  Truck, Building2, UserCheck,
} from "lucide-react";
import { runBookingApi, type DropoffInfo } from "@/services/carrier";

type Phase =
  | "loading"
  | "ready"
  | "confirming_dropoff"
  | "confirming_pickup"
  | "done_dropoff"
  | "done_pickup"
  | "error"
  | "already_received";

export default function DropoffPage() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase]   = useState<Phase>("loading");
  const [info, setInfo]     = useState<DropoffInfo | null>(null);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!token) { setPhase("error"); setErrMsg("No token provided."); return; }
    runBookingApi.getDropoffInfo(token)
      .then((data) => {
        setInfo(data);
        setPhase(data.status === "received" ? "already_received" : "ready");
      })
      .catch((e: unknown) => {
        const err = e as { response?: { status?: number; data?: { error?: string } } };
        const status = err?.response?.status;
        setErrMsg(
          status === 410 ? "This drop-off token has expired." :
          status === 404 ? "Invalid or unknown drop-off token." :
          err?.response?.data?.error || "Could not load handover information."
        );
        setPhase("error");
      });
  }, [token]);

  async function handleDropoff() {
    if (!token) return;
    setPhase("confirming_dropoff");
    setErrMsg("");
    try {
      const result = await runBookingApi.confirmDropoff(token);
      if (result.alreadyReceived) { setPhase("already_received"); return; }
      setPhase("done_dropoff");
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string } } };
      setErrMsg(
        err?.response?.status === 402 ? "Insufficient wallet balance on the sender's account." :
        err?.response?.data?.error || "Failed to confirm receipt. Try again."
      );
      setPhase("ready");
    }
  }

  async function handlePickup() {
    if (!token) return;
    setPhase("confirming_pickup");
    setErrMsg("");
    try {
      const result = await runBookingApi.confirmPickup(token);
      if (result.alreadyReceived) { setPhase("already_received"); return; }
      setPhase("done_pickup");
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string } } };
      setErrMsg(
        err?.response?.status === 402 ? "Insufficient wallet balance on the sender's account." :
        err?.response?.data?.error || "Failed to confirm pick-up. Try again."
      );
      setPhase("ready");
    }
  }

  const isConfirming = phase === "confirming_dropoff" || phase === "confirming_pickup";

  return (
    <div className="min-h-screen bg-[#060d18] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-2.5 px-5 h-14 border-b border-white/[0.06]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
          <Truck className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold tracking-tight">Trackam</span>
        <span className="text-stone-600 text-xs ml-1">· Carrier handover</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-4">

          {/* Loading */}
          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="h-6 w-6 text-stone-500 animate-spin" />
              <p className="text-sm text-stone-500">Loading handover details…</p>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-6 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
              <p className="text-sm font-semibold text-white">Invalid link</p>
              <p className="text-xs text-red-400/80">{errMsg}</p>
            </div>
          )}

          {/* Already received */}
          {phase === "already_received" && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-6 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
              <p className="text-base font-semibold text-white">Already confirmed</p>
              <p className="text-xs text-stone-500">
                This handover was already recorded
                {info?.receivedAt
                  ? ` on ${new Date(info.receivedAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}`
                  : ""}.
              </p>
            </div>
          )}

          {/* Done — hub received (drop-off) */}
          {phase === "done_dropoff" && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-6 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
              <p className="text-base font-semibold text-white">Receipt confirmed</p>
              <p className="text-xs text-stone-500">
                {info?.waybills?.length ?? 0} waybill{(info?.waybills?.length ?? 0) !== 1 ? "s" : ""} received
                from <span className="text-stone-300">{info?.bookerName ?? "the operator"}</span>.
                OLI custody transferred to your hub.
              </p>
            </div>
          )}

          {/* Done — rider picked up */}
          {phase === "done_pickup" && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-6 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-blue-400 mx-auto" />
              <p className="text-base font-semibold text-white">Picked up</p>
              <p className="text-xs text-stone-500">
                {info?.waybills?.length ?? 0} waybill{(info?.waybills?.length ?? 0) !== 1 ? "s" : ""} collected
                from <span className="text-stone-300">{info?.bookerName ?? "the operator"}</span>.
                Use <span className="text-stone-300">join-leg</span> at your hub to complete the chain.
              </p>
            </div>
          )}

          {/* Ready */}
          {(phase === "ready" || isConfirming) && info && (
            <>
              {/* Route + parties */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">Handover details</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-stone-200">{info.originCity}</span>
                  <ArrowRight className="h-4 w-4 text-stone-600 shrink-0" />
                  <span className="font-medium text-stone-200">{info.destCity}</span>
                </div>
                <div className="text-xs space-y-1 text-stone-500">
                  <p>From: <span className="text-stone-300">{info.bookerName ?? "Operator"}</span></p>
                  <p>To: <span className="text-stone-300">{info.carrierName ?? "Your carrier"}</span></p>
                </div>
              </div>

              {/* Waybills */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] divide-y divide-white/[0.04]">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <p className="text-xs font-medium text-stone-300">Waybills</p>
                  <span className="text-xs font-bold text-white">{info.waybills.length}</span>
                </div>
                {info.waybills.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-stone-500">No waybills listed.</div>
                ) : info.waybills.map((w) => (
                  <div key={w.waybillId} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-7 w-7 rounded-md bg-white/[0.06] flex items-center justify-center shrink-0">
                      <Package className="h-3.5 w-3.5 text-stone-500" />
                    </div>
                    <p className="text-xs font-mono font-semibold text-stone-200">
                      {w.waybillNumber ?? w.waybillId}
                    </p>
                  </div>
                ))}
              </div>

              {errMsg && (
                <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{errMsg}
                </p>
              )}

              <p className="text-[11px] text-center text-stone-600 font-medium uppercase tracking-wide">
                Select your role
              </p>

              {/* Pick-up — carrier's rider collecting from booker */}
              <button
                onClick={handlePickup}
                disabled={isConfirming}
                className="w-full flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] hover:bg-blue-500/[0.12] px-4 h-14 text-left disabled:opacity-60 transition-all"
              >
                <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  {phase === "confirming_pickup"
                    ? <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                    : <Truck className="h-4 w-4 text-blue-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Carrier's rider — picking up</p>
                  <p className="text-[11px] text-stone-500">Taking custody now, delivering to hub</p>
                </div>
              </button>

              {/* Drop-off — carrier's hub receiving from booker's rider */}
              <button
                onClick={handleDropoff}
                disabled={isConfirming}
                className="w-full flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] hover:bg-emerald-500/[0.12] px-4 h-14 text-left disabled:opacity-60 transition-all"
              >
                <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  {phase === "confirming_dropoff"
                    ? <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
                    : <Building2 className="h-4 w-4 text-emerald-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Hub staff — confirming receipt</p>
                  <p className="text-[11px] text-stone-500">Shipments delivered here by sender's rider</p>
                </div>
              </button>

              <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
                <UserCheck className="h-4 w-4 text-stone-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Both actions record an OLI custody transfer and debit the sender's handover fee. If picking up, complete the chain at your hub via join-leg.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
