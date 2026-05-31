import { useEffect, useMemo, useState } from "react";
import {
  fetchDevices,
  fetchSessions,
  type DeviceItem,
  type SessionItem,
} from "@/services/dashboard.api";

export default function SecurityPage() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [d, s] = await Promise.all([fetchDevices(), fetchSessions()]);
        if (!active) return;
        setDevices(d);
        setSessions(s);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const sortedDevices = useMemo(
    () =>
      [...devices].sort(
        (a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0)
      ),
    [devices]
  );

  const sortedSessions = useMemo(
    () => [...sessions],
    [sessions]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded-md bg-white/[0.06] animate-pulse" />
          <div className="h-3 w-72 rounded-md bg-white/[0.04] animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 animate-pulse space-y-3">
            <div className="h-3 w-20 rounded-md bg-white/[0.06]" />
            <div className="h-3 w-full rounded-md bg-white/[0.04]" />
            <div className="h-3 w-5/6 rounded-md bg-white/[0.04]" />
          </section>
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 animate-pulse space-y-3">
            <div className="h-3 w-24 rounded-md bg-white/[0.06]" />
            <div className="h-3 w-full rounded-md bg-white/[0.04]" />
            <div className="h-3 w-4/6 rounded-md bg-white/[0.04]" />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white">Security</h2>
        <p className="text-sm text-stone-500">
          Devices and sessions associated with your account.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-stone-300">Devices</h3>
            {sortedDevices.length > 0 && (
              <span className="text-[11px] uppercase tracking-wide text-stone-600">
                {sortedDevices.length} device
                {sortedDevices.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {sortedDevices.length === 0 ? (
            <p className="text-sm text-stone-500">
              No devices have been registered yet.
            </p>
          ) : (
            <div className="space-y-2">
              {sortedDevices.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-xs transition-colors hover:bg-white/[0.06]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-stone-200">
                        {d.deviceId}
                      </span>
                      {d.isCurrent && (
                        <span className="inline-flex items-center rounded-full bg-orange-500/[0.1] border border-orange-500/20 px-2 py-0.5 text-[10px] font-medium text-orange-400">
                          Current device
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-stone-600">
                      Last seen:{" "}
                      {d.lastSeen
                        ? new Date(d.lastSeen).toLocaleString()
                        : "Unknown"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-stone-300">Sessions</h3>
            {sortedSessions.length > 0 && (
              <span className="text-[11px] uppercase tracking-wide text-stone-600">
                {sortedSessions.length} session
                {sortedSessions.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {sortedSessions.length === 0 ? (
            <p className="text-sm text-stone-500">
              No recent sessions recorded.
            </p>
          ) : (
            <div className="space-y-2">
              {sortedSessions.map((s) => {
                const isActive = !s.endedAt;
                const started = s.createdAt
                  ? new Date(s.createdAt).toLocaleString()
                  : "Unknown";
                const ended = s.endedAt
                  ? new Date(s.endedAt).toLocaleString()
                  : null;

                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-xs transition-colors hover:bg-white/[0.06]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-stone-200">
                          {s.ip ?? "Unknown IP"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-stone-600">
                        Started: {started}
                        {ended && (
                          <>
                            {" | "}Ended: {ended}
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      className={
                        "ml-3 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium " +
                        (isActive
                          ? "bg-orange-500/[0.1] border-orange-500/20 text-orange-400"
                          : "bg-white/[0.06] border-white/[0.06] text-stone-500")
                      }
                    >
                      {isActive ? "Active" : "Ended"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
