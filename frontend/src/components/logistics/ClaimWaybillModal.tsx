/**
 * Claim a waybill modal — scan the waybill QR or enter the number + claim
 * code manually. Mirrors JoinLegModal's design and scanner pattern.
 *
 * Flow:
 *   1. idle      — Scan QR (primary) or Enter manually (escape hatch)
 *   2. scanning  — Camera open, looking for the waybill QR
 *   3. manual    — Form: waybill number + claim code
 *   4. claiming  — Calling waybillApi.claim
 *   5. success   — Show "View shipment" link
 *   6. error     — Generic error with Retry
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  X, ScanLine, Camera, FileText, Loader2,
  CheckCircle2, AlertCircle, ArrowRight,
} from "lucide-react";
import QRScanner from "@/components/QRScanner";
import { waybillApi, publicWaybillApi } from "@/services/handover";

type Phase = "idle" | "scanning" | "manual" | "claiming" | "success" | "error";

interface Props {
  onClose: () => void;
  onClaimed?: (shipmentId: string) => void;
}

/**
 * Extract the waybill ID from whatever was scanned.
 * The waybill QR encodes a /track/<uuid> URL.
 */
function extractWaybillId(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/track\/([a-f0-9-]{36})/i);
    if (match) return match[1];
  } catch { /* not a URL */ }
  // bare UUID
  if (/^[a-f0-9-]{36}$/i.test(trimmed)) return trimmed;
  return null;
}

export default function ClaimWaybillModal({ onClose, onClaimed }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [error, setError] = useState("");
  const [claimedShipmentId, setClaimedShipmentId] = useState<string | null>(null);
  const [claimedNumber, setClaimedNumber] = useState("");
  const [scanLoading, setScanLoading] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleScanResult(raw: string) {
    const waybillId = extractWaybillId(raw);
    if (!waybillId) {
      // Might be a waybill number directly (WB-...)
      const numberMatch = raw.trim().match(/WB-[\dA-Z-]+/i);
      if (numberMatch) {
        setWaybillNumber(numberMatch[0].toUpperCase());
        setPhase("manual");
        return;
      }
      setError("That doesn't look like a Trackam waybill QR code. Try scanning again or enter the number manually.");
      setPhase("error");
      return;
    }

    // Fetch waybill to get the number
    setScanLoading(true);
    setPhase("manual");
    try {
      const wb = await publicWaybillApi.get(waybillId);
      setWaybillNumber(wb.waybillNumber || "");
    } catch {
      // Couldn't fetch — let user type it
    } finally {
      setScanLoading(false);
    }
  }

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!waybillNumber || !claimCode) return;
    setPhase("claiming");
    setError("");
    try {
      const result = await waybillApi.claim({
        waybillNumber: waybillNumber.trim().toUpperCase(),
        claimToken: claimCode.trim().toUpperCase(),
      });
      setClaimedShipmentId(result.shipmentId);
      setClaimedNumber(waybillNumber.trim().toUpperCase());
      setPhase("success");
      onClaimed?.(result.shipmentId);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Claim failed. Check the waybill number and code.");
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setWaybillNumber("");
    setClaimCode("");
    setError("");
    setClaimedShipmentId(null);
    setClaimedNumber("");
    setScanLoading(false);
  }

  const inputCls = "w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-xs font-mono text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Claim a waybill"
        className="relative w-full max-w-md rounded-xl bg-[#0c1522] shadow-2xl shadow-black/50 border border-white/[0.08] overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <FileText className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Claim a waybill</p>
              <p className="text-[11px] text-stone-500">Scan the QR or enter the number and claim code</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">

          {/* ── IDLE ─────────────────────────────────────────────────────── */}
          {phase === "idle" && (
            <div className="space-y-4">
              <button
                onClick={() => setPhase("scanning")}
                className="w-full rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/[0.12] to-orange-600/[0.04] hover:from-orange-500/[0.18] hover:border-orange-500/40 p-5 transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                    <Camera className="h-5 w-5 text-orange-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Scan the waybill QR</p>
                    <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
                      Point your camera at the QR on the physical waybill slip. Fills in the number automatically.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setPhase("manual")}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] p-5 transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                    <ScanLine className="h-5 w-5 text-stone-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-200">Enter manually</p>
                    <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                      Type the waybill number and 8-character claim code from the tear-off stub.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* ── SCANNING ─────────────────────────────────────────────────── */}
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

          {/* ── MANUAL FORM ──────────────────────────────────────────────── */}
          {phase === "manual" && (
            <form id="claim-form" onSubmit={handleClaim} className="space-y-4">
              {scanLoading && (
                <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400 shrink-0" />
                  <p className="text-[11px] text-stone-400">Looking up waybill…</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">Waybill number</label>
                <input
                  required
                  autoFocus={!waybillNumber}
                  value={waybillNumber}
                  onChange={(e) => setWaybillNumber(e.target.value.toUpperCase())}
                  placeholder="WB-20260508-XXXXXX"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">Claim code</label>
                <input
                  required
                  autoFocus={!!waybillNumber}
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A3F9B2C1"
                  maxLength={8}
                  className={`${inputCls} tracking-widest`}
                />
                <p className="text-[10px] text-stone-600 mt-1">
                  Printed on the tear-off stub at the bottom of the waybill PDF.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPhase("idle")}
                className="text-[11px] text-stone-500 hover:text-stone-300 transition-colors"
              >
                ← Back
              </button>
            </form>
          )}

          {/* ── CLAIMING ─────────────────────────────────────────────────── */}
          {phase === "claiming" && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
              <p className="text-sm text-stone-300">Claiming waybill…</p>
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
                <p className="text-base font-semibold text-white">Waybill claimed</p>
                <p className="text-xs text-stone-400 mt-1">
                  <span className="font-mono text-stone-300">{claimedNumber}</span> is on your dashboard.
                  Assign it to a run when you're ready to dispatch.
                </p>
              </div>
              <div className="w-full grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] h-10 text-xs font-medium text-stone-300 transition-all"
                >
                  Close
                </button>
                {claimedShipmentId && (
                  <Link
                    to={`/dashboard/shipments/${claimedShipmentId}`}
                    onClick={onClose}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 h-10 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 transition-all"
                  >
                    View shipment <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
              <button onClick={reset} className="text-[11px] text-stone-500 hover:text-stone-300 transition-colors">
                Claim another waybill
              </button>
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
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 px-4 h-9 text-xs font-semibold text-white transition-all"
              >
                <ScanLine className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          )}
        </div>

        {/* Footer CTA — only in manual form */}
        {phase === "manual" && (
          <div className="px-5 py-3 border-t border-white/[0.06] shrink-0">
            <button
              type="submit"
              form="claim-form"
              disabled={!waybillNumber || !claimCode || scanLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 h-9 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-50 transition-all"
            >
              Claim waybill <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
