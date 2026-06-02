import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, ShieldCheck, Activity, Plug, Wallet, Settings,
  ChevronRight, ArrowUpRight, CheckCircle2, AlertCircle,
} from "lucide-react";
import {
  fetchAllUsers,
  fetchEvents,
  fetchRoles,
  orgOliApi,
  type AdminUser,
  type EventItem,
  type RoleItem,
  type OrgOliStatus,
} from "@/services/admin.api";
import { walletApi, type WalletData } from "@/services/handover";
import { formatNaira } from "@/lib/format";

type State = {
  users: AdminUser[];
  roles: RoleItem[];
  events: EventItem[];
  oli: OrgOliStatus | null;
  wallet: WalletData | null;
};

const initial: State = { users: [], roles: [], events: [], oli: null, wallet: null };

export default function AdminOverview() {
  const [state, setState] = useState<State>(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [users, roles, events, oli, wallet] = await Promise.all([
          fetchAllUsers().catch(() => []),
          fetchRoles().catch(() => []),
          fetchEvents().catch(() => []),
          orgOliApi.get().catch(() => null),
          walletApi.get().catch(() => null),
        ]);
        if (!active) return;
        setState({ users, roles, events, oli, wallet });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <OverviewSkeleton />;

  const oliConnected = state.oli?.status === "active" && state.oli?.hasApiKey;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Setup banner — only when OLI isn't connected */}
      {!oliConnected && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-300">Connect your organisation to the OLI network</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Once you paste your OLI API key, all operators on this instance can claim waybills and run handovers.
            </p>
          </div>
          <Link
            to="/admin/dashboard/oli"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 px-3 h-8 text-xs font-semibold text-amber-200 transition-colors"
          >
            Set up <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link
          to="/admin/dashboard/users"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 px-4 h-10 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 transition-all"
        >
          <Users className="h-3.5 w-3.5" /> Manage users
        </Link>
        <Link
          to="/admin/dashboard/wallet"
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.14] hover:border-emerald-500/40 px-4 h-10 text-xs font-semibold text-emerald-200 transition-all"
        >
          <Wallet className="h-3.5 w-3.5" /> Top up wallet
        </Link>
        <Link
          to="/admin/dashboard/settings"
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] px-4 h-10 text-xs font-medium text-stone-300 hover:text-white transition-all"
        >
          <Settings className="h-3.5 w-3.5" /> Org settings
        </Link>
      </div>

      {/* Stat row */}
      <section>
        <SectionLabel>At a glance</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Users"
            value={state.users.length}
            icon={<Users className="h-3.5 w-3.5" />}
            href="/admin/dashboard/users"
          />
          <StatCard
            label="Roles"
            value={state.roles.length}
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            href="/admin/dashboard/roles"
          />
          <StatCard
            label="Events"
            value={state.events.length}
            icon={<Activity className="h-3.5 w-3.5" />}
            href="/admin/dashboard/events"
          />
          <StatCard
            label="Wallet"
            value={state.wallet ? formatNaira(state.wallet.balance) : "—"}
            icon={<Wallet className="h-3.5 w-3.5" />}
            href="/admin/dashboard/wallet"
            valueClass="text-emerald-400"
          />
        </div>
      </section>

      {/* Two-column: connection status + recent activity */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Connection status — wide */}
        <div className="lg:col-span-1 rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
          <header className="px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Plug className="h-3.5 w-3.5 text-stone-400" /> Network
            </h3>
          </header>
          <div className="p-5 space-y-3">
            <StatusRow
              label="OLI connection"
              connected={oliConnected}
              connectedText="Active"
              pendingText="Not connected"
              href="/admin/dashboard/oli"
            />
            <StatusRow
              label="Org wallet"
              connected={!!state.wallet && state.wallet.balance > 0}
              connectedText={state.wallet ? formatNaira(state.wallet.balance) : "Funded"}
              pendingText={state.wallet ? "Top up needed" : "No wallet"}
              href="/admin/dashboard/wallet"
            />
          </div>
        </div>

        {/* Recent users */}
        <div className="lg:col-span-1 rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
          <header className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-stone-400" /> Recent users
            </h3>
            <Link to="/admin/dashboard/users" className="text-[11px] text-stone-500 hover:text-orange-400 transition-colors inline-flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </header>
          {state.users.length === 0 ? (
            <EmptyRow text="No users yet." />
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {state.users.slice(0, 5).map((u) => (
                <li key={u.id} className="px-5 py-2.5 hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-stone-700 to-stone-800 flex items-center justify-center text-[10px] font-bold text-stone-300 shrink-0">
                      {(u.displayName || u.email || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-stone-200 truncate">
                        {u.displayName || u.email || u.id}
                      </div>
                      <div className="text-[10px] text-stone-600 truncate">{u.email}</div>
                    </div>
                    {Array.isArray(u.roles) && u.roles.length > 0 && (
                      <span className="shrink-0 inline-flex items-center rounded-full bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-stone-400">
                        {u.roles[0]}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent events */}
        <div className="lg:col-span-1 rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
          <header className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-stone-400" /> Recent events
            </h3>
            <Link to="/admin/dashboard/events" className="text-[11px] text-stone-500 hover:text-orange-400 transition-colors inline-flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </header>
          {state.events.length === 0 ? (
            <EmptyRow text="No events yet." />
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {state.events.slice(0, 6).map((evt) => (
                <li key={evt.id} className="px-5 py-2.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-orange-400/60 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-stone-300 truncate">{evt.type}</div>
                      <div className="text-[10px] text-stone-600">
                        {formatEventTime(evt.createdAt)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-wider text-stone-600 mb-2 px-1">
      {children}
    </h2>
  );
}

function StatCard({
  label, value, icon, href, valueClass,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  href: string;
  valueClass?: string;
}) {
  return (
    <Link
      to={href}
      className="group rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.1] p-4 transition-all"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</p>
        <span className="text-stone-600 group-hover:text-orange-400 transition-colors">{icon}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueClass || "text-white"}`}>
        {value}
      </p>
    </Link>
  );
}

function StatusRow({
  label, connected, connectedText, pendingText, href,
}: {
  label: string;
  connected: boolean;
  connectedText: string;
  pendingText: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="group flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.08] px-3 py-2.5 transition-all"
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-stone-300">{label}</p>
        <p className={`text-[11px] mt-0.5 inline-flex items-center gap-1 ${connected ? "text-emerald-400" : "text-amber-400"}`}>
          {connected
            ? <><CheckCircle2 className="h-3 w-3" /> {connectedText}</>
            : <><AlertCircle className="h-3 w-3" /> {pendingText}</>}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-stone-600 group-hover:text-stone-400 transition-colors shrink-0" />
    </Link>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-5 py-6 text-xs text-stone-600 text-center">{text}</p>;
}

// events.created_at is BIGINT (millis); pg returns BIGINT as strings, so we
// must Number() before passing to Date() — otherwise we get Invalid Date.
function formatEventTime(createdAt: number | string | null | undefined): string {
  if (createdAt == null || createdAt === "") return "unknown";
  const n = typeof createdAt === "string" ? Number(createdAt) : createdAt;
  if (!Number.isFinite(n)) return "unknown";
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? "unknown" : d.toLocaleString();
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5 max-w-6xl animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
        ))}
      </div>
    </div>
  );
}
