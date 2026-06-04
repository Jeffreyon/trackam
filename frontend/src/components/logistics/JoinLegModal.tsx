/**
 * "Join a leg" modal — the in-dashboard flow for an operator picking up
 * custody from a courier or upstream operator.
 *
 * Replaces the legacy /join?token=... URL share. The driver still shows
 * a QR with the handover token, but the receiving operator never has to
 * leave their dashboard or paste a credential out-of-band. They scan,
 * preview, accept — done.
 *
 * Flow:
 *   1. idle      — Scan QR (primary) or Paste token (escape hatch)
 *   2. scanning  — Camera open, looking for a code
 *   3. preview   — Token resolved; show shipment summary + Accept button
 *   4. joining   — Calling confirmAndJoin
 *   5. success   — Show "View shipment" link
 *   6. error     — Generic error with Retry
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  X, ScanLine, Camera, ClipboardPaste, Loader2, ShieldCheck,
  MapPin, CheckCircle2, AlertCircle, ArrowRight, Package,
} from "lucide-react";
import QRScanner from "@/components/QRScanner";
import {
  publicHandoverApi, publicBatchApi, waybillApi, ACTOR_LABELS,
  type TokenInfo, type BatchTokenInfo,
} from "@/services/handover";
import { useProfileStore } from "@/hooks/useProfile";

type Phase = "idle" | "scanning" | "preview" | "joining" | "success" | "error";

interface Props {
  onClose: () => void;
  onJoined?: (shipmentId: string) => void;
}

/**
 * Extract the handover token from whatever the operator scanned / pasted.
 * Drivers' QR codes encode a /scan?token=... or /join?token=... URL, so
 * users can also paste those URLs and we'll pull the token out.
 */
function extractToken(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Looks like a URL?
  try {
    const url = new URL(trimmed);
    const t = url.searchParams.get("token");
    if (t) return t;
  } catch { /* not a url, try as-is */ }
  // Long hex strings are handover tokens
  if (/^[a-f0-9]{32,}$/i.test(trimmed)) return trimmed;
  return null;
}

export default function JoinLegModal({ onClose, onJoined }: Props) {
  const profile = useProfileStore((s) => s.profile);

  const [phase, setPhase] = useState<Phase>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [batchInfo, setBatchInfo] = useState<BatchTokenInfo | null>(null);
  const [error, setError] = useState("");
  const [joinedShipmentId, setJoinedShipmentId] = useState<string | null>(null);

  const [pasteValue, setPasteValue] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);

  // Close on Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function loadTokenInfo(rawToken: string) {
    const extracted = extractToken(rawToken);
    if (!extracted) {
      setError("That doesn't look like a valid handover code. Try scanning the driver's QR again.");
      setPhase("error");
      return;
    }
    setToken(extracted);
    setPhase("preview");
    try {
      // Try batch token first — dispatch runs generate bulk tokens
      const batch = await publicBatchApi.getInfo(extracted).catch(() => null);
      if (batch) {
        setBatchInfo(batch);
        return; // preview renders from batchInfo
      }
      // Fall back to single handover token
      const info = await publicHandoverApi.getTokenInfo(extracted);
      setTokenInfo(info);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Invalid or expired handover code.");
      setPhase("error");
    }
  }

  function handleScanResult(text: string) {
    loadTokenInfo(text);
  }

  async function handleAccept() {
    if (!token) return;
    setPhase("joining");
    setError("");
    try {
      const displayName = (profile as { displayName?: string; email?: string } | null)?.displayName
        || (profile as { email?: string } | null)?.email
        || "Operator";

      if (batchInfo) {
        // Batch token — operator confirms receipt of all shipments in one call
        const result = await publicBatchApi.confirm({
          token,
          receiverName: displayName,
          receiverActorType: batchInfo.receiverActorType,
        });
        // For batch there's no single shipmentId — signal success with the first
        setJoinedShipmentId(result.proofHashes?.[0]?.shipmentId ?? null);
        setPhase("success");
        onJoined?.(result.proofHashes?.[0]?.shipmentId ?? "");
      } else {
        const result = await waybillApi.confirmAndJoin(token, displayName);
        setJoinedShipmentId(result.shipmentId);
        setPhase("success");
        onJoined?.(result.shipmentId);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Couldn't join this leg. The token may have already been used.");
      setPhase("error");
    }
  }

  function reset() {
    setToken(null);
    setTokenInfo(null);
    setBatchInfo(null);
    setError("");
    setJoinedShipmentId(null);
    setPasteValue("");
    setPasteOpen(false);
    setPhase("idle");
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Join custody leg"
        className="relative w-full max-w-md rounded-xl bg-[#0c1522] shadow-2xl shadow-black/50 border border-white/[0.08] overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <ScanLine className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Join a leg</p>
              <p className="text-[11px] text-stone-500">Take custody of a shipment from a courier</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">

          {/* ── IDLE — pick scan or paste ─────────────────────────────────── */}
          {phase === "idle" && (
            <div className="space-y-4">
              <button
                onClick={() => setPhase("scanning")}
                className="w-full rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.12] to-purple-600/[0.04] hover:from-purple-500/[0.18] hover:border-purple-500/40 p-5 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                    <Camera className="h-5 w-5 text-purple-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Scan the driver's QR</p>
                    <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
                      Point your camera at the QR on the driver's phone. Fastest, no typing.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setPasteOpen((v) => !v)}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] p-5 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                    <ClipboardPaste className="h-5 w-5 text-stone-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-200">Paste a code</p>
                    <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                      Backup option if the driver sent you the join link or raw code.
                    </p>
                  </div>
                </div>
              </button>

              {pasteOpen && (
                <div className="space-y-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                  <input
                    type="text"
                    value={pasteValue}
                    onChange={(e) => setPasteValue(e.target.value)}
                    placeholder="Paste link or token"
                    autoFocus
                    className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-xs font-mono text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                  />
                  <button
                    onClick={() => loadTokenInfo(pasteValue)}
                    disabled={!pasteValue.trim()}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-b from-orange-500 to-orange-600 h-9 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 disabled:opacity-50 transition-all"
                  >
                    Look up code <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── SCANNING — camera view ────────────────────────────────────── */}
          {phase === "scanning" && (
            <div className="space-y-3">
              <QRScanner
                onScan={handleScanResult}
                onError={(msg) => { setError(msg); setPhase("error"); }}
              />
              <button
                onClick={() => setPhase("idle")}
                className="w-full text-[11px] text-stone-500 hover:text-stone-300 transition-colors"
              >
                Cancel — go back
              </button>
            </div>
          )}

          {/* ── PREVIEW — confirm before accepting ────────────────────────── */}
          {phase === "preview" && (
            <div className="space-y-4">
              {!tokenInfo && !batchInfo ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                  <p className="text-xs text-stone-400">Looking up handover…</p>
                </div>
              ) : batchInfo ? (
                // ── Batch token — show all shipments in the run ──────────
                <>
                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/[0.06] p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-purple-400 shrink-0" />
                      <p className="text-xs font-semibold text-purple-200">
                        {batchInfo.shipments.length} shipment{batchInfo.shipments.length !== 1 ? "s" : ""} incoming
                      </p>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {batchInfo.shipments.map((s) => (
                        <div key={s.shipmentId} className="rounded-md bg-white/[0.04] border border-purple-500/10 px-2.5 py-1.5">
                          {s.waybillNumber && (
                            <p className="text-[10px] font-mono font-semibold text-purple-300">{s.waybillNumber}</p>
                          )}
                          <p className="text-[11px] text-purple-300/80 truncate">{s.goodsDescription}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3">
                    <p className="text-[11px] text-amber-300 leading-relaxed">
                      Accepting will record a proof-of-handover for each shipment using your operator identity.
                      Your name will be recorded on all {batchInfo.shipments.length} events.
                    </p>
                  </div>

                  <button
                    onClick={handleAccept}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 h-11 text-sm font-semibold text-white shadow-sm shadow-purple-500/20 transition-all"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Accept all {batchInfo.shipments.length} shipments
                  </button>
                  <button onClick={reset} className="w-full text-[11px] text-stone-500 hover:text-stone-300 transition-colors">
                    Cancel
                  </button>
                </>
              ) : tokenInfo ? (
                // ── Single token ─────────────────────────────────────────
                <>
                  <div className="flex items-start gap-3 rounded-lg border border-purple-500/20 bg-purple-500/[0.06] p-3">
                    <Package className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-purple-200 truncate">
                        {tokenInfo.shipment.goodsDescription}
                      </p>
                      <p className="text-[11px] text-purple-400/80 mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{tokenInfo.shipment.pickupLocation} → {tokenInfo.shipment.deliveryLocation}</span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 space-y-1.5">
                    <p className="text-[11px] text-stone-500">Custody is moving from</p>
                    <p className="text-xs font-semibold text-white">
                      {tokenInfo.giverName || "Driver"}
                      <span className="ml-1.5 text-[11px] font-normal text-stone-400">
                        ({ACTOR_LABELS[tokenInfo.giverActorType]})
                      </span>
                    </p>
                    <p className="text-[11px] text-stone-500 mt-1">to your hub.</p>
                  </div>

                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3">
                    <p className="text-[11px] text-amber-300 leading-relaxed">
                      Accepting will record a proof-of-handover on the network and add this
                      shipment to your dashboard. The driver's screen will update in real time.
                    </p>
                  </div>

                  <button
                    onClick={handleAccept}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 h-11 text-sm font-semibold text-white shadow-sm shadow-purple-500/20 transition-all"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Accept custody
                  </button>
                  <button onClick={reset} className="w-full text-[11px] text-stone-500 hover:text-stone-300 transition-colors">
                    Cancel
                  </button>
                </>
              ) : null}
            </div>
          )}

          {/* ── JOINING — saving ─────────────────────────────────────────── */}
          {phase === "joining" && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-7 w-7 animate-spin text-purple-400" />
              <p className="text-sm text-stone-300">Recording handover…</p>
              <p className="text-[11px] text-stone-500">Don't close this window.</p>
            </div>
          )}

          {/* ── SUCCESS ──────────────────────────────────────────────────── */}
          {phase === "success" && (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">Custody received</p>
                <p className="text-xs text-stone-400 mt-1">The shipment is now on your dashboard.</p>
              </div>
              <div className="w-full grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] h-10 text-xs font-medium text-stone-300 transition-all"
                >
                  Close
                </button>
                {joinedShipmentId && (
                  <Link
                    to={`/dashboard/shipments/${joinedShipmentId}`}
                    onClick={onClose}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 h-10 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 transition-all"
                  >
                    View shipment <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ── ERROR ────────────────────────────────────────────────────── */}
          {phase === "error" && (
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <div className="h-12 w-12 rounded-full bg-red-500/15 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <p className="text-sm font-semibold text-white">Something went wrong</p>
              <p className="text-xs text-stone-400 max-w-xs">{error}</p>
              <button
                onClick={reset}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 px-4 h-9 text-xs font-semibold text-white transition-all"
              >
                <ScanLine className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
