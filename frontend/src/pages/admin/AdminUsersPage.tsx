import { useEffect, useState } from "react";
import { Shield, UserX, UserCheck, Loader2 } from "lucide-react";
import {
  fetchAllUsers, fetchRoles, updateUserRoles, toggleUserDisabled,
  type AdminUser, type RoleItem,
} from "@/services/admin.api";
import { useProfileStore } from "@/hooks/useProfile";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const currentUserId = useProfileStore((s) => s.profile?.id);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [u, r] = await Promise.all([fetchAllUsers(), fetchRoles()]);
        if (!active) return;
        setUsers(u);
        setRoles(r);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function handleToggleRole(user: AdminUser, role: string) {
    setBusyId(user.id);
    const currentRoles = Array.isArray(user.roles) ? user.roles : [];
    const nextRoles = currentRoles.includes(role)
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role];
    try {
      const updated = await updateUserRoles(user.id, nextRoles);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, roles: updated.roles } : u)));
    } catch {
      // handled
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleDisabled(user: AdminUser) {
    setBusyId(user.id);
    const isDisabled = Boolean((user as unknown as { preferences?: { disabled?: boolean } }).preferences?.disabled);
    try {
      const updated = await toggleUserDisabled(user.id, !isDisabled);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
    } catch {
      // handled
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-28 rounded-md bg-muted/60 animate-pulse" />
          <div className="h-3 w-72 rounded-md bg-muted/40 animate-pulse" />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2">
          <div className="h-3 w-full rounded-md bg-muted/40" />
          <div className="h-3 w-11/12 rounded-md bg-muted/40" />
          <div className="h-3 w-10/12 rounded-md bg-muted/40" />
        </div>
      </div>
    );
  }

  const availableRoles = roles.map((r) => r.id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Users</h2>
        <p className="text-sm text-muted-foreground">
          Manage operators on this instance. Assign roles to control what each user can access.
        </p>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
          No users found.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-background/60">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Roles</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const userRoles = Array.isArray(user.roles) ? user.roles : [];
                const isDisabled = Boolean((user as unknown as { preferences?: { disabled?: boolean } }).preferences?.disabled);
                const isSelf = user.id === currentUserId;
                const busy = busyId === user.id;

                return (
                  <tr
                    key={user.id}
                    className={`border-t border-border/60 transition-colors ${isDisabled ? "opacity-50" : "hover:bg-muted/40"}`}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm font-medium">
                        {user.displayName || user.email || user.id}
                        {isSelf && (
                          <span className="ml-1.5 text-[10px] text-orange-400 font-medium">(you)</span>
                        )}
                      </div>
                      {isDisabled && (
                        <span className="text-[10px] text-red-400 font-medium">Disabled</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-muted-foreground">
                      {user.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1">
                        {availableRoles.map((role) => {
                          const active = userRoles.includes(role);
                          return (
                            <button
                              key={role}
                              type="button"
                              disabled={busy || isSelf}
                              onClick={() => handleToggleRole(user, role)}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border transition-all ${
                                active
                                  ? "bg-orange-500/[0.12] border-orange-500/25 text-orange-300 hover:bg-orange-500/[0.2]"
                                  : "bg-white/[0.03] border-white/[0.06] text-stone-500 hover:border-white/[0.12] hover:text-stone-300"
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              title={isSelf ? "Cannot change your own roles" : `${active ? "Remove" : "Add"} ${role} role`}
                            >
                              {busy ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <Shield className="h-2.5 w-2.5" />
                              )}
                              {role}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      {!isSelf && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleToggleDisabled(user)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 h-7 text-[11px] font-medium transition-all disabled:opacity-50 ${
                            isDisabled
                              ? "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/[0.1]"
                              : "border-red-500/20 text-red-400 hover:bg-red-500/[0.1]"
                          }`}
                          title={isDisabled ? "Re-enable this user" : "Disable this user"}
                        >
                          {isDisabled
                            ? <><UserCheck className="h-3 w-3" /> Enable</>
                            : <><UserX className="h-3 w-3" /> Disable</>}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
