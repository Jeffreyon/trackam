import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfileStore } from "@/hooks/useProfile";
import { clearAuthToken } from "@/lib/authToken";
import { apiClient } from "@/lib/apiClient";
import {
  LayoutDashboard,
  Package,
  Users,
  MapPin,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Truck,
  Menu,
  X,
  FileText,
  Route,
} from "lucide-react";
import NotificationBell from "./NotificationBell";

const NAV_ITEMS = [
  { to: "/dashboard",           label: "Overview",  icon: LayoutDashboard, end: true },
  { to: "/dashboard/waybills",  label: "Waybills",  icon: FileText,        end: false },
  { to: "/dashboard/runs",      label: "Runs",      icon: Route,           end: false },
  { to: "/dashboard/shipments", label: "Shipments", icon: Package,         end: false },
  { to: "/dashboard/riders",    label: "Riders",    icon: Users,           end: false },
  { to: "/dashboard/routes",    label: "Routes",    icon: MapPin,          end: false },
  { to: "/dashboard/settings",  label: "Settings",  icon: Settings,        end: false },
];

const PAGE_TITLES: Record<string, { title: string; description: string }> = {
  "/dashboard":           { title: "Overview",       description: "Your logistics at a glance." },
  "/dashboard/waybills":  { title: "Waybills",       description: "Claim OLI waybills and join custody legs." },
  "/dashboard/runs":      { title: "Dispatch Runs",  description: "Group waybills onto vehicle trips and manage departures." },
  "/dashboard/shipments": { title: "Shipments",      description: "Individual waybill legs and their custody status." },
  "/dashboard/riders":    { title: "Riders",         description: "Manage your logistics vendors." },
  "/dashboard/routes":    { title: "Routes",         description: "Set up your standard delivery lanes." },
  "/dashboard/settings":  { title: "Settings",       description: "Fuel rates, business info, and preferences." },
  "/dashboard/account":   { title: "Account",        description: "Manage your profile." },
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
  profile: import("@/types/profile").Profile | null;
  loggingOut: boolean;
  onLogout: () => void;
  onToggleCollapse?: () => void;
  showCollapseButton: boolean;
}) {
  return (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-3 h-14 border-b border-sidebar-border shrink-0 ${collapsed ? "justify-center" : ""}`}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
          <Truck className="h-4 w-4 text-white" />
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              key="brand"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.14 }}
              className="text-sm font-semibold tracking-tight text-sidebar-foreground whitespace-nowrap"
            >
              Trackam
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavClick}
            className={({ isActive }) =>
              [
                "flex items-center gap-2.5 rounded-md text-xs font-medium transition-colors",
                collapsed ? "h-9 w-full justify-center px-0" : "h-9 px-3",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
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
      </nav>

      {/* Footer */}
      <div className="px-2 pb-4 space-y-1 border-t border-sidebar-border pt-3 shrink-0">
        <AnimatePresence initial={false}>
          {!collapsed && profile && (
            <motion.div
              key="user-chip"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="px-3 py-2.5 rounded-md bg-sidebar-accent/50 mb-2"
            >
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {(profile as any).displayName || (profile as any).email}
              </p>
              <p className="text-[11px] text-sidebar-foreground/50 truncate">{(profile as any).email}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`flex gap-1.5 ${collapsed ? "flex-col items-center" : ""}`}>
          <button
            onClick={onLogout}
            disabled={loggingOut}
            title="Log out"
            className={[
              "flex items-center justify-center gap-2 rounded-md text-xs font-medium text-sidebar-foreground/60 transition-colors hover:bg-destructive/20 hover:text-red-400 disabled:opacity-50",
              collapsed ? "h-9 w-full" : "h-9 flex-1 px-3",
            ].join(" ")}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && (loggingOut ? "Logging out…" : "Log out")}
          </button>

          {showCollapseButton && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title={collapsed ? "Expand" : "Collapse"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default function DashboardLayout() {
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
  const page = pageKey ? PAGE_TITLES[pageKey] : { title: "Dashboard", description: "" };

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
    <div className="h-screen bg-background text-foreground flex overflow-hidden">

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 56 : 220 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="hidden md:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border overflow-hidden shrink-0"
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
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Drawer panel */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border md:hidden"
            >
              {/* Close button */}
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute right-3 top-3.5 flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/40 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
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
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
          {/* Mobile hamburger + logo */}
          <div className="flex items-center gap-2.5 md:hidden">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-secondary transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
                <Truck className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold tracking-tight">Trackam</span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-foreground">{page.title}</h1>
            {page.description && (
              <p className="hidden sm:block text-xs text-muted-foreground">{page.description}</p>
            )}
          </div>

          <NotificationBell />
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export type { ReactNode };
