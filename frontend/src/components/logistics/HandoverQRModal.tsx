import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Loader2, Copy, Check, ArrowRight, CheckCircle2 } from "lucide-react";
import { handoverApi, ACTOR_LABELS, type ActorType } from "@/services/handover";
import { triggerWalletRefresh } from "@/components/layout/WalletWidget";

interface Props {
  shipmentId: string;
  goodsDescription: string;
  onClose: () => void;
  onConfirmed?: () => void;
}

const ACTOR_OPTIONS: ActorType[] = ["ACTOR_COURIER", "ACTOR_HUB", "ACTOR_RECEIVER", "ACTOR_SENDER"];

export default function HandoverQRModal({ shipmentId, goodsDescription, onClose, onConfirmed }: Props) {
  const [actorType, setActorType] = useState<ActorType>("ACTOR_COURIER");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedEvent, setConfirmedEvent] = useState<import("@/services/handover").HandoverEvent | null>(null);
  const initialEventCountRef = useRef<number>(-1);

  const scanUrl = token
    ? `${window.location.origin}/scan?token=${token}`
    : null;

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      // Snapshot current event count before generating the token
      const existing = await handoverApi.getEvents(shipmentId).catch(() => []);
      initialEventCountRef.current = existing.length;

      const result = await handoverApi.initiate(shipmentId, actorType);
      setToken(result.token);
      setExpiresAt(result.expiresAt);
      const secs = Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000);
      setSecondsLeft(secs);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (status === 402) {
        setError("Insufficient wallet balance. Please top up your OLI Switch wallet and try again.");
      } else {
        setError(msg || "Failed to generate handover QR. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Keep a ref so the poll closure can read the latest secondsLeft without being
  // in the dependency array (which would cancel + restart the interval every second)
  const secondsLeftRef = useRef(secondsLeft);
  useEffect(() => { secondsLeftRef.current = secondsLeft; }, [secondsLeft]);

  // Poll for confirmation — only restarts when the token itself changes
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(async () => {
      if (secondsLeftRef.current <= 0) return; // token expired, stop checking
      try {
        const events = await handoverApi.getEvents(shipmentId);
        if (events.length > initialEventCountRef.current) {
          clearInterval(interval);
          setConfirmedEvent(events[events.length - 1]);
          setConfirmed(true);
          triggerWalletRefresh();
          onConfirmed?.();
        }
      } catch {
        // best-effort
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown — separate from polling so it doesn't disturb it
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  function copyLink() {
    if (!scanUrl) return;
    navigator.clipboard.writeText(scanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">Initiate Handover</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{goodsDescription}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {confirmed ? (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Handover confirmed</p>
                {confirmedEvent && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Custody transferred to{" "}
                      <span className="font-medium text-foreground">{confirmedEvent.receiverName}</span>
                      {" "}({ACTOR_LABELS[confirmedEvent.receiverActorType]})
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground pt-1">
                      PoH: {confirmedEvent.proofHash.slice(0, 20)}…
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full inline-flex items-center justify-center rounded-md bg-green-600 hover:bg-green-700 text-white h-9 text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          ) : !token ? (
            <>
              {/* Actor type selector */}
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Who is receiving custody?</p>
                <div className="grid grid-cols-2 gap-2">
                  {ACTOR_OPTIONS.map((type) => (
                    <button
                      key={type}
                      onClick={() => setActorType(type)}
                      className={[
                        "rounded-md border px-3 py-2 text-[11px] font-medium text-left transition-colors",
                        actorType === type
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40",
                      ].join(" ")}
                    >
                      {ACTOR_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <button
                onClick={generate}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground h-9 text-sm font-medium transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Generate QR code
              </button>
            </>
          ) : (
            <>
              {/* QR code */}
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-lg border border-border p-3 bg-white">
                  <QRCodeSVG value={scanUrl!} size={180} />
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    Ask the receiver to scan this QR code
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    Waiting for receiver…
                  </p>
                  {secondsLeft > 0 ? (
                    <p className="text-xs font-medium text-amber-700 mt-1">
                      Expires in {mins}:{String(secs).padStart(2, "0")}
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-red-600 mt-1">Expired — generate a new code</p>
                  )}
                </div>
              </div>

              {/* Copy link */}
              <button
                onClick={copyLink}
                disabled={secondsLeft === 0}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border h-8 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy link to share"}
              </button>

              {secondsLeft === 0 && (
                <button
                  onClick={() => { setToken(null); setExpiresAt(null); }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground h-8 text-xs font-medium"
                >
                  Generate new code
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
