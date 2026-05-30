import { useEffect, useRef, useState } from "react";
import { Bell, ShieldCheck, X } from "lucide-react";
import { getAuthToken } from "@/lib/authToken";
import { ACTOR_LABELS, type ActorType } from "@/services/handover";
import { triggerWalletRefresh } from "./WalletWidget";

interface WaybillNotification {
  id: string;
  waybillId: string | null;
  shipmentId: string;
  receiverName: string;
  receiverActorType: ActorType;
  occurredAt: string;
  joinLegUrl: string | null;
  read: boolean;
}

function publicBase() {
  const cfg = (window as unknown as { __APP_CONFIG__?: { VITE_API_URL?: string } }).__APP_CONFIG__;
  return cfg?.VITE_API_URL || import.meta.env.VITE_API_URL || "";
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<WaybillNotification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  // SSE subscription for real-time custody notifications
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const base = publicBase();
    const qs = `?token=${encodeURIComponent(token)}`;
    const es = new EventSource(`${base}/api/waybill/stream/notifications${qs}`);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "waybill_handover") {
          setNotifications((prev) => [
            {
              id: crypto.randomUUID(),
              waybillId: data.waybillId || null,
              shipmentId: data.shipmentId,
              receiverName: data.receiverName,
              receiverActorType: data.receiverActorType,
              occurredAt: data.occurredAt,
              joinLegUrl: data.joinLegUrl || null,
              read: false,
            },
            ...prev,
          ]);
          // Handover confirmation means a fee was charged — refresh wallet
          triggerWalletRefresh();
        }
      } catch {
        // malformed event — ignore
      }
    };

    return () => es.close();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleOpen() {
    setOpen((v) => !v);
    // Mark all read on open
    if (!open) setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-[8px] font-bold text-white leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-white shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-foreground">Incoming custody alerts</p>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <ShieldCheck className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No custody alerts yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <a
                  key={n.id}
                  href={n.joinLegUrl || (n.waybillId ? `/track/${n.waybillId}` : `/dashboard/shipments/${n.shipmentId}`)}
                  className="flex gap-3 px-4 py-3 hover:bg-secondary/50 border-b border-border/50 last:border-0 transition-colors"
                >
                  <div className={[
                    "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    n.joinLegUrl ? "bg-orange-100" : "bg-purple-100",
                  ].join(" ")}>
                    <ShieldCheck className={["h-3.5 w-3.5", n.joinLegUrl ? "text-orange-600" : "text-purple-600"].join(" ")} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground leading-snug">
                      {n.joinLegUrl ? "New leg available" : "Handover"} — {n.receiverName}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {ACTOR_LABELS[n.receiverActorType]} · {new Date(n.occurredAt).toLocaleString("en-NG")}
                    </p>
                    {n.joinLegUrl && (
                      <p className="text-[10px] text-orange-600 font-medium mt-0.5">Tap to join this leg →</p>
                    )}
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
