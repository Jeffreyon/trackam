import { useEffect, useState } from "react";
import {
  fetchNotifications,
  markNotificationsRead,
  type NotificationItem,
} from "@/services/dashboard.api";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchNotifications();
        if (!active) return;
        setNotifications(data);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleMarkAllRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (!unreadIds.length) return;
    await markNotificationsRead(unreadIds);
    setNotifications((prev) =>
      prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read: true } : n))
    );
  }

  const loadingSkeleton = (
    <ul className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.06] bg-white/[0.03]">
      {Array.from({ length: 3 }).map((_, idx) => (
        <li
          key={idx}
          className="flex items-start gap-3 px-4 py-3 text-sm animate-pulse"
        >
          <div className="mt-1 h-2 w-2 rounded-full bg-white/[0.06]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 rounded-md bg-white/[0.06]" />
            <div className="h-3 w-full rounded-md bg-white/[0.04]" />
            <div className="h-2 w-24 rounded-md bg-white/[0.03]" />
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Notifications</h2>
          <p className="text-sm text-stone-500">
            Recent updates about your account and workspace activity.
          </p>
        </div>
        <button
          type="button"
          onClick={handleMarkAllRead}
          className="text-xs rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-stone-400 hover:bg-white/[0.06] hover:text-stone-300 disabled:opacity-60 transition-colors"
          disabled={notifications.every((n) => n.read)}
        >
          Mark all as read
        </button>
      </div>

      {loading
        ? loadingSkeleton
        : notifications.length === 0
        ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.03] p-4 text-sm text-stone-500">
            You don&apos;t have any notifications yet.
          </div>
          )
        : (
          <ul className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.06] bg-white/[0.03]">
            {notifications.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-white/[0.04] transition-colors"
              >
                <div
                  className="mt-1 h-2 w-2 rounded-full bg-orange-500"
                  hidden={n.read}
                />
                <div className="flex-1">
                  <div className="font-medium text-stone-200">{n.title}</div>
                  <div className="text-stone-500">{n.body}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-stone-600">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          )}
    </div>
  );
}
