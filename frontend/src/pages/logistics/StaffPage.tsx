import { useEffect, useState, useMemo } from "react";
import {
  Users, Search, Phone as PhoneIcon, Mail, Shield,
  User as UserIcon, Star,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";

interface StaffMember {
  id: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  roles: string[];
}

async function fetchStaffDirectory(): Promise<StaffMember[]> {
  const { data } = await apiClient.get("/api/users/directory");
  return data as StaffMember[];
}

function RoleBadge({ role }: { role: string }) {
  if (role === "owner") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/[0.12] border border-orange-500/25 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-orange-300">
        <Star className="h-2.5 w-2.5" /> Owner
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/[0.1] border border-purple-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-purple-300">
      <Shield className="h-2.5 w-2.5" /> {role}
    </span>
  );
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchStaffDirectory().then(setStaff).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) =>
      (s.displayName || "").toLowerCase().includes(q)
      || (s.email || "").toLowerCase().includes(q)
      || (s.phone || "").toLowerCase().includes(q)
      || s.roles.some((r) => r.toLowerCase().includes(q))
    );
  }, [staff, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-600" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff by name, email, or role…"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-9 pr-3 h-9 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
          />
        </div>
        <p className="ml-auto text-xs text-stone-500 hidden sm:block shrink-0">
          {staff.length} member{staff.length !== 1 ? "s" : ""}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.03] py-16 text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-10 w-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
              <Users className="h-5 w-5 text-stone-500" />
            </div>
          </div>
          <p className="text-sm font-medium text-stone-300">
            {staff.length === 0 ? "No staff yet" : "No staff match your search"}
          </p>
          <p className="text-xs text-stone-500">
            {staff.length === 0
              ? "Staff members are added from the admin dashboard."
              : "Try a different name, email, or role."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((member) => (
            <StaffCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffCard({ member }: { member: StaffMember }) {
  const initials = (member.displayName || member.email || "?")
    .split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 hover:bg-white/[0.05] hover:border-white/[0.10] transition-all">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-stone-700 to-stone-800 border border-white/[0.06] flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-stone-200">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
            {member.displayName || <span className="text-stone-500 italic">No display name</span>}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {member.roles.length > 0
              ? member.roles.map((r) => <RoleBadge key={r} role={r} />)
              : <span className="text-[10px] text-stone-600">No roles</span>}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {member.email && (
          <p className="text-[11px] text-stone-400 flex items-center gap-1.5 min-w-0">
            <Mail className="h-2.5 w-2.5 text-stone-600 shrink-0" />
            <span className="truncate">{member.email}</span>
          </p>
        )}
        {member.phone ? (
          <p className="text-[11px] text-stone-400 flex items-center gap-1.5">
            <PhoneIcon className="h-2.5 w-2.5 text-stone-600 shrink-0" />
            <a
              href={`tel:${member.phone}`}
              className="font-mono hover:text-orange-400 transition-colors"
            >
              {member.phone}
            </a>
          </p>
        ) : (
          <p className="text-[11px] text-stone-600 flex items-center gap-1.5">
            <UserIcon className="h-2.5 w-2.5 shrink-0" />
            No phone on file
          </p>
        )}
      </div>
    </div>
  );
}
