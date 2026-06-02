import { useEffect, useState } from "react";
import { Activity, Search } from "lucide-react";
import { fetchEvents, type EventItem } from "@/services/admin.api";

// events.created_at is BIGINT (millis since epoch). pg returns BIGINT as
// strings to avoid precision loss, so we coerce to Number before constructing
// a Date — otherwise `new Date("1748880000000")` returns Invalid Date.
function formatEventTime(createdAt: number | string | null | undefined): string {
  if (createdAt == null || createdAt === "") return "Unknown";
  const n = typeof createdAt === "string" ? Number(createdAt) : createdAt;
  if (!Number.isFinite(n)) return "Unknown";
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? "Unknown" : d.toLocaleString();
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchEvents();
        if (!active) return;
        setEvents(data);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl animate-pulse">
        <div className="h-9 rounded-lg bg-white/[0.03] border border-white/[0.06]" />
        <div className="h-64 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
      </div>
    );
  }

  const filtered = events.filter((e) =>
    !search || e.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-600" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter events by type…"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-9 pr-3 h-9 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center">
          <Activity className="h-8 w-8 text-stone-600 mx-auto mb-3" />
          <p className="text-sm text-stone-500">
            {search ? "No events match your filter." : "No events recorded yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_180px] gap-3 px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-600">Event</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-600">When</span>
          </div>
          <ul className="divide-y divide-white/[0.04]">
            {filtered.map((evt) => (
              <li
                key={evt.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-2 px-5 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-orange-400/60 shrink-0" />
                  <span className="text-xs font-medium text-stone-200 truncate font-mono">{evt.type}</span>
                </div>
                <span className="text-[11px] text-stone-500 tabular-nums">
                  {formatEventTime(evt.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
