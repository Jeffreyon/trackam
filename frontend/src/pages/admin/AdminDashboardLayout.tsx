import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfileStore } from "@/hooks/useProfile";
import { clearAuthToken } from "@/lib/authToken";
import { apiClient } from "@/lib/apiClient";
import {
  LayoutDashboard,
  Users,
  Activity,
  ShieldCheck,
  Settings,
  Plug,
  Wallet,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Truck,
  Menu,
  X,
  ArrowLeftRight,
  Bike,
} from "lucide-react";
import WalletWidget from "@/components/layout/WalletWidget";
import type { Profile } from "@/types/profile";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end: boolean;
};

const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: "/admin/dashboard",                       label: "Overview",         icon: LayoutDashboard, end: true  },
      { to: "/admin/dashboard/users",                 label: "Users",            icon: Users,           end: false },
      { to: "/admin/dashboard/roles",                 label: "Roles",            icon: ShieldCheck,     end: false },
      { to: "/admin/dashboard/events",                label: "Events",           icon: Activity,        end: false },
      { to: "/admin/dashboard/riders",                 label: "Riders",           icon: Bike,            end: false },
      { to: "/admin/dashboard/identity-verifications",label: "Identity IDs",     icon: ShieldCheck,     end: false },
    ],
  },
  {
    label: "Organisation",
    items: [
      { to: "/admin/dashboard/settings", label: "Settings", icon: Settings, end: false },
      { to: "/admin/dashboard/oli",      label: "Network",  icon: Plug,     end: false },
      { to: "/admin/dashboard/wallet",   label: "Wallet",   icon: Wallet,   end: false },
    ],
  },
];

const PAGE_TITLES: Record<string, { title: string; description: string }> = {
  "/admin/dashboard":          { title: "Admin Overview", description: "Users, roles, and activity across your instance." },
  "/admin/dashboard/users":    { title: "Users",          description: "Assign roles and manage operator access." },
  "/admin/dashboard/roles":    { title: "Roles",          description: "Available RBAC roles and their permissions." },
  "/admin/dashboard/events":   { title: "Events",         description: "Recent system events." },
  "/admin/dashboard/riders":                 { title: "Riders",                description: "Add, edit, and remove riders from your dispatch roster." },
  "/admin/dashboard/identity-verifications": { title: "Identity Verifications", description: "Approve or reject IDs submitted by riders and staff during onboarding." },
  "/admin/dashboard/settings": { title: "Organisation Settings", description: "Business name, fuel pricing, and alerts — shared across all operators." },
  "/admin/dashboard/oli":      { title: "Network Connection",    description: "Connect your organisation to the OLI custody network." },
  "/admin/dashboard/wallet":   { title: "Organisation Wallet",   description: "Credits fund handovers, claims, and custody operations on the OLI network." },
};

function SidebarContent({
  collapsed,
  onNavClick,
  profile,
  loggingOut,
  onLogout,
  onToggleCollapse,
  showCollapseButton,
}: {
  collapsed: boolean;
  onNavClick?: () => void;
  profile: Profile | null;
  loggingOut: boolean;
  onLogout: () => void;
  onToggleCollapse?: () => void;
  showCollapseButton: boolean;
}) {
  return (
    <>
      {/* Logo */}
      <a
        href="/admin/dashboard"
        className={`flex items-center gap-2.5 px-3 h-14 border-b border-white/[0.06] shrink-0 ${collapsed ? "justify-center" : ""}`}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 shadow-sm shadow-orange-500/30">
          <Truck className="h-4 w-4 text-white" />
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="brand"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.14 }}
              className="flex items-baseline gap-1.5 min-w-0"
            >
              <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap">Trackam</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-400/80 whitespace-nowrap">Admin</span>
            </motion.div>
          )}
        </AnimatePresence>
      </a>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-3 overflow-y-auto">
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-0.5">
            <AnimatePresence initial={false}>
              {!collapsed && group.label && (
                <motion.div
                  key={`group-${groupIdx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-600"
                >
                  {group.label}
                </motion.div>
              )}
            </AnimatePresence>
            {collapsed && group.label && groupIdx > 0 && (
              <div className="mx-auto my-2 h-px w-6 bg-white/[0.06]" />
            )}
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavClick}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-2.5 rounded-lg text-xs font-medium transition-all duration-150",
                    collapsed ? "h-9 w-full justify-center px-0" : "h-9 px-3",
                    isActive
                      ? "bg-orange-500/[0.12] text-orange-400 shadow-sm shadow-orange-500/5"
                      : "text-stone-500 hover:bg-white/[0.04] hover:text-stone-300",
                  ].join(" ")
                }
                title={collapsed ? label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      key={`label-${to}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-4 space-y-1 border-t border-white/[0.06] pt-3 shrink-0">
        <NavLink
          to="/dashboard"
          onClick={onNavClick}
          title="Switch to operator view"
          className={[
            "flex items-center gap-2.5 rounded-lg text-xs font-medium transition-all duration-150",
            collapsed ? "h-9 w-full justify-center px-0" : "h-9 px-3",
            "text-stone-500 hover:bg-white/[0.04] hover:text-stone-300",
          ].join(" ")}
        >
          <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">Operator view</span>}
        </NavLink>

        <AnimatePresence initial={false}>
          {!collapsed && profile && (
            <motion.div
              key="user-chip"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] my-2"
            >
              <p className="text-xs font-medium text-stone-300 truncate">
                {profile.displayName || profile.email}
              </p>
              <p className="text-[11px] text-stone-600 truncate">{profile.email}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-500/[0.12] border border-orange-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-orange-300">
                <ShieldCheck className="h-2.5 w-2.5" />
                Owner
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`flex gap-1.5 ${collapsed ? "flex-col items-center" : ""}`}>
          <button
            onClick={onLogout}
            disabled={loggingOut}
            title="Log out"
            className={[
              "flex items-center justify-center gap-2 rounded-lg text-xs font-medium text-stone-600 transition-colors hover:bg-red-500/[0.1] hover:text-red-400 disabled:opacity-50",
              collapsed ? "h-9 w-full" : "h-9 flex-1 px-3",
            ].join(" ")}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && (loggingOut ? "Logging out..." : "Log out")}
          </button>

          {showCollapseButton && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title={collapsed ? "Expand" : "Collapse"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-white/[0.04] hover:text-stone-400"
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminDashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useProfileStore((s) => s.profile);
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const pageKey = Object.keys(PAGE_TITLES)
    .sort((a, b) => b.length - a.length)
    .find((k) => location.pathname.startsWith(k));
  const page = pageKey ? PAGE_TITLES[pageKey] : { title: "Admin", description: "" };

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiClient.post("/api/auth/logout", {}, { withCredentials: true });
    } catch {
      // best-effort
    } finally {
      clearAuthToken();
      useProfileStore.getState().setProfile(null);
      setLoggingOut(false);
      navigate("/auth/login", { replace: true });
    }
  }

  const sidebarProps = {
    profile,
    loggingOut,
    onLogout: handleLogout,
  };

  return (
    <div className="h-screen bg-[#060d18] text-white flex overflow-hidden">

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 56 : 220 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="hidden md:flex flex-col bg-[#0a1220] border-r border-white/[0.06] overflow-hidden shrink-0"
      >
        <SidebarContent
          {...sidebarProps}
          collapsed={collapsed}
          showCollapseButton
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
      </motion.aside>

      {/* ── Mobile drawer overlay ────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setDrawerOpen(false)}
            />

            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0a1220] border-r border-white/[0.06] md:hidden"
            >
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute right-3 top-3.5 flex h-7 w-7 items-center justify-center rounded-lg text-stone-600 hover:bg-white/[0.06] hover:text-stone-400 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>

              <SidebarContent
                {...sidebarProps}
                collapsed={false}
                showCollapseButton={false}
                onNavClick={() => setDrawerOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#060d18]/80 backdrop-blur-xl px-4 md:px-6">
          {/* Mobile hamburger + logo */}
          <div className="flex items-center gap-2.5 md:hidden">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-white/[0.06] hover:text-white transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
                <Truck className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white">Trackam</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-400/80">Admin</span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-white">{page.title}</h1>
            {page.description && (
              <p className="hidden sm:block text-xs text-stone-500">{page.description}</p>
            )}
          </div>

          <WalletWidget />
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export type { ReactNode };
