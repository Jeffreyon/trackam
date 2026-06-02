import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/apiClient";
import { clearAuthToken } from "@/lib/authToken";
import { useProfileStore } from "@/hooks/useProfile";
import {
  LayoutDashboard,
  Users,
  Activity,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  Plug,
  Wallet,
} from "lucide-react";

export default function AdminDashboardLayout() {
  const navigate = useNavigate();
  const profile = useProfileStore((s) => s.profile);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiClient.post(
        "/api/auth/logout",
        {},
        { withCredentials: true }
      );
    } catch {
      // non-fatal
    } finally {
      clearAuthToken();
      useProfileStore.getState().setProfile(null);
      setLoggingOut(false);
      navigate("/auth/login", { replace: true });
    }
  }

  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden">
      <motion.aside
        className={[
          "hidden md:flex border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex-col py-6 gap-6 overflow-y-auto",
          sidebarCollapsed ? "px-2" : "px-3",
        ].join(" ")}
        animate={{ width: sidebarCollapsed ? 64 : 224 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        <Link
          to="/admin/dashboard"
          className={[
            "inline-flex items-center text-sm font-semibold",
            sidebarCollapsed ? "justify-center" : "gap-2",
          ].join(" ")}
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary shadow-xs overflow-hidden">
            <img
              src="/bkyd%20gem.png"
              alt="Logo"
              className="h-6 w-6 rounded-full object-cover"
            />
          </span>
          {!sidebarCollapsed && (
            <span className="tracking-wide uppercase text-xs text-sidebar-foreground/70">
              Admin Panel
            </span>
          )}
        </Link>

        <nav className="flex-1 mt-4 space-y-1 text-xs">
          <AdminNavLink
            to="/admin/dashboard"
            label="Overview"
            icon={<LayoutDashboard className="h-3.5 w-3.5" />}
            collapsed={sidebarCollapsed}
          />
          <AdminNavLink
            to="/admin/dashboard/users"
            label="Users"
            icon={<Users className="h-3.5 w-3.5" />}
            collapsed={sidebarCollapsed}
          />
          <AdminNavLink
            to="/admin/dashboard/events"
            label="Events"
            icon={<Activity className="h-3.5 w-3.5" />}
            collapsed={sidebarCollapsed}
          />
          <AdminNavLink
            to="/admin/dashboard/roles"
            label="Roles"
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            collapsed={sidebarCollapsed}
          />

          {!sidebarCollapsed && (
            <div className="pt-4 pb-1 px-3">
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">Organisation</span>
            </div>
          )}

          <AdminNavLink
            to="/admin/dashboard/settings"
            label="Settings"
            icon={<Settings className="h-3.5 w-3.5" />}
            collapsed={sidebarCollapsed}
          />
          <AdminNavLink
            to="/admin/dashboard/oli"
            label="Network"
            icon={<Plug className="h-3.5 w-3.5" />}
            collapsed={sidebarCollapsed}
          />
          <AdminNavLink
            to="/admin/dashboard/wallet"
            label="Wallet"
            icon={<Wallet className="h-3.5 w-3.5" />}
            collapsed={sidebarCollapsed}
          />
        </nav>

        <div className="mt-auto space-y-3 text-xs text-sidebar-foreground/70">
          {profile && !sidebarCollapsed && (
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-3 shadow-xs">
              <div className="font-medium text-sidebar-foreground">
                {profile.displayName || profile.email}
              </div>
              <div className="truncate text-sidebar-foreground/70">
                {profile.email}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-sidebar-foreground/60">
                Admin
              </div>
            </div>
          )}
          <div
            className={
              sidebarCollapsed
                ? "space-y-3"
                : "flex items-center gap-2"
            }
          >
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className={[
                "border border-sidebar-border bg-sidebar text-xs font-medium text-sidebar-foreground/80 transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-60",
                sidebarCollapsed
                  ? "inline-flex h-8 w-full items-center justify-center rounded-md"
                  : "flex-1 h-8 rounded-md px-3",
              ].join(" ")}
              aria-label={sidebarCollapsed ? "Log out" : undefined}
            >
              {sidebarCollapsed ? (
                <LogOut className="h-3.5 w-3.5" />
              ) : loggingOut ? (
                "Logging out..."
              ) : (
                "Log out"
              )}
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className={[
                "inline-flex items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground/70 hover:bg-sidebar-accent/60",
                sidebarCollapsed ? "h-8 w-full" : "h-8 w-8",
              ].join(" ")}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </motion.aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-sm font-semibold">Admin dashboard</h1>
            <p className="text-xs text-muted-foreground">
              Manage users, roles, and system events.
            </p>
          </div>
        </header>
        <section className="flex-1 px-4 py-4 md:px-6 md:py-6 overflow-y-auto">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

type AdminNavLinkProps = {
  to: string;
  label: string;
  icon: ReactNode;
  collapsed: boolean;
};

function AdminNavLink({ to, label, icon, collapsed }: AdminNavLinkProps) {
  return (
    <NavLink
      to={to}
      end={to === "/admin/dashboard"}
      className={({ isActive }) => {
        const active =
          "bg-sidebar-accent text-sidebar-accent-foreground";
        const inactive =
          "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground";
        const layout = collapsed
          ? "flex items-center justify-center rounded-md h-8 w-full transition-colors"
          : "flex items-center gap-2 rounded-md px-3 py-2 w-full transition-colors";
        return [layout, isActive ? active : inactive].join(" ");
      }}
    >
      <span className="inline-flex items-center gap-2">
        <span className="text-sidebar-foreground/60">{icon}</span>
        {!collapsed && <span>{label}</span>}
      </span>
    </NavLink>
  );
}
