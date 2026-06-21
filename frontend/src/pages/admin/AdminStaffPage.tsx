"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  Users, X, Loader2, AlertCircle, Mail, Phone as PhoneIcon,
  Edit2, Search, ShieldCheck, ShieldAlert, Clock, Upload, CheckCircle2,
} from "lucide-react";
import {
  fetchAllUsers, fetchUserWithPhoto, updateStaffProfile, verifyStaff, rejectStaff,
  type AdminUser,
} from "@/services/admin.api";
import type { GovtIdType, VerificationState } from "@/services/logistics";

const ID_TYPE_LABELS: Record<GovtIdType, string> = {
  nin: "NIN",
  voters_card: "Voter's Card",
  passport: "International Passport",
  drivers_license: "Driver's License",
};

const VERIFICATION_CFG: Record<VerificationState, { label: string; icon: typeof ShieldCheck; cls: string }> = {
  missing:  { label: "No ID on file",    icon: Clock,        cls: "text-stone-400 border-stone-700 bg-stone-800/40" },
  pending:  { label: "Pending review",   icon: Clock,        cls: "text-amber-400 border-amber-500/20 bg-amber-500/10" },
  verified: { label: "Verified",         icon: ShieldCheck,  cls: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" },
  rejected: { label: "Rejected",         icon: ShieldAlert,  cls: "text-red-400 border-red-500/20 bg-red-500/10" },
};

function VerifBadge({ state }: { state?: VerificationState }) {
  const s = state ?? "missing";
  const { label, icon: Icon, cls } = VERIFICATION_CFG[s];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      <Icon className="h-2.5 w-2.5" />{label}
    </span>
  );
}

const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors";

// ── StaffModal ────────────────────────────────────────────────────────────────

function StaffModal({ user, onClose, onSaved }: {
  user: AdminUser;
  onClose: () => void;
  onSaved: (updated: AdminUser) => void;
}) {
  const [full, setFull] = useState<AdminUser | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(true);
  const [form, setForm] = useState({
    phone:        user.phone ?? "",
    govtIdType:   (user.govtIdType ?? "") as GovtIdType | "",
    govtIdNumber: user.govtIdNumber ?? "",
    govtIdPhoto:  "" as string,
  });
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [error, setError] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUserWithPhoto(user.id)
      .then((u) => {
        setFull(u);
        setForm({
          phone:        u.phone ?? "",
          govtIdType:   (u.govtIdType ?? "") as GovtIdType | "",
          govtIdNumber: u.govtIdNumber ?? "",
          govtIdPhoto:  u.govtIdPhoto ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setLoadingPhoto(false));
  }, [user.id]);

  function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, govtIdPhoto: ev.target?.result as string ?? "" }));
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const updated = await updateStaffProfile(user.id, {
        phone:        form.phone || undefined,
        govtIdType:   (form.govtIdType || null) as GovtIdType | null,
        govtIdNumber: form.govtIdNumber || null,
        govtIdPhoto:  form.govtIdPhoto || null,
      });
      onSaved(updated);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setError("");
    try {
      const updated = await verifyStaff(user.id);
      onSaved(updated);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to verify.");
      setVerifying(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) { setError("Enter a rejection reason."); return; }
    setRejecting(true);
    setError("");
    try {
      const updated = await rejectStaff(user.id, rejectReason);
      onSaved(updated);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to reject.");
      setRejecting(false);
    }
  }

  const state = (full ?? user).verificationState;
  const displayName = user.displayName || user.email || "Staff member";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full sm:max-w-lg rounded-t-xl sm:rounded-xl border border-white/[0.08] bg-[#0c1522] shadow-2xl shadow-black/40 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-blue-300">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
            <p className="text-[11px] text-stone-500 truncate">{user.email}</p>
          </div>
          <VerifBadge state={state} />
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loadingPhoto ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-5 w-5 animate-spin text-stone-500" />
            </div>
          ) : (
            <>
              {/* Contact */}
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">Phone number</label>
                <input
                  className={inputCls}
                  placeholder="e.g. +2348012345678"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>

              {/* ID Type */}
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">Government ID type</label>
                <select
                  className={inputCls}
                  value={form.govtIdType}
                  onChange={(e) => setForm((f) => ({ ...f, govtIdType: e.target.value as GovtIdType | "" }))}
                >
                  <option value="" className="bg-[#0c1522]">Select ID type</option>
                  {(Object.entries(ID_TYPE_LABELS) as [GovtIdType, string][]).map(([k, v]) => (
                    <option key={k} value={k} className="bg-[#0c1522]">{v}</option>
                  ))}
                </select>
              </div>

              {/* ID Number */}
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">ID number</label>
                <input
                  className={inputCls}
                  placeholder="Enter ID number"
                  value={form.govtIdNumber}
                  onChange={(e) => setForm((f) => ({ ...f, govtIdNumber: e.target.value }))}
                />
              </div>

              {/* ID Photo */}
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">ID photo</label>
                {form.govtIdPhoto ? (
                  <div className="space-y-2">
                    <img
                      src={form.govtIdPhoto}
                      alt="Government ID"
                      className="h-32 w-full object-cover rounded-lg border border-white/[0.08]"
                    />
                    <button
                      type="button"
                      onClick={() => { setForm((f) => ({ ...f, govtIdPhoto: "" })); if (photoRef.current) photoRef.current.value = ""; }}
                      className="text-[11px] text-stone-500 hover:text-red-400 transition-colors"
                    >
                      Remove photo
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => photoRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] h-20 text-stone-500 hover:border-orange-500/30 hover:text-stone-300 transition-all"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-[11px]">Click to upload ID photo</span>
                  </button>
                )}
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
              </div>

              {/* Previous rejection reason */}
              {state === "rejected" && (full ?? user).govtIdRejectionReason && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5">
                  <p className="text-[11px] text-red-400 font-medium">Previously rejected</p>
                  <p className="text-[11px] text-red-300/70 mt-0.5">{(full ?? user).govtIdRejectionReason}</p>
                </div>
              )}

              {error && (
                <p className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-white/[0.06] shrink-0 space-y-2">
          {/* Save profile */}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 h-9 text-xs font-medium text-stone-400 hover:text-white hover:bg-white/[0.06] transition-all">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || loadingPhoto}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 h-9 text-xs font-semibold text-white disabled:opacity-60 transition-all">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>

          {/* Verify / Reject */}
          {state !== "verified" && (
            <div className="flex gap-2">
              {showRejectInput ? (
                <div className="flex-1 flex gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder="Rejection reason…"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    autoFocus
                  />
                  <button onClick={handleReject} disabled={rejecting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 h-9 text-xs font-semibold text-white disabled:opacity-60 hover:bg-red-700 transition-all">
                    {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    Reject
                  </button>
                  <button onClick={() => setShowRejectInput(false)} className="px-2 h-9 rounded-lg border border-white/[0.08] text-stone-500 hover:text-white transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={() => setShowRejectInput(true)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/[0.06] text-red-300 h-9 text-xs font-medium hover:bg-red-500/[0.1] transition-all">
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                  <button onClick={handleVerify} disabled={verifying}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 h-9 text-xs font-semibold text-white disabled:opacity-60 transition-all">
                    {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    {verifying ? "Verifying…" : "Approve & verify"}
                  </button>
                </>
              )}
            </div>
          )}

          {state === "verified" && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] h-9">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-300">Identity verified — can join custody legs</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AdminStaffPage ─────────────────────────────────────────────────────────────

export default function AdminStaffPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [filter, setFilter] = useState<VerificationState | "all">("all");

  function load() {
    setLoading(true);
    fetchAllUsers().then(setUsers).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (filter !== "all") list = list.filter((u) => (u.verificationState ?? "missing") === filter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((u) =>
      (u.displayName || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q)
    );
    return list;
  }, [users, search, filter]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: users.length, missing: 0, pending: 0, verified: 0, rejected: 0 };
    users.forEach((u) => { out[(u.verificationState ?? "missing")]++; });
    return out;
  }, [users]);

  function handleSaved(updated: AdminUser) {
    setUsers((prev) => prev.map((u) => u.id === updated.id ? { ...u, ...updated } : u));
    setEditing(null);
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-600" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff by name or email…"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-9 pr-3 h-9 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
          />
        </div>
        <p className="ml-auto text-xs text-stone-500 hidden sm:block">
          {counts.verified} verified · {counts.pending} pending · {counts.missing} no ID
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {(["all", "verified", "pending", "missing", "rejected"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              filter === f ? "border-orange-500 text-white" : "border-transparent text-stone-500 hover:text-stone-300"
            }`}>
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            {counts[f] > 0 && <span className="ml-1.5 text-stone-600 font-normal">{counts[f]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] py-16 text-center space-y-2">
          <Users className="h-8 w-8 text-stone-600 mx-auto" />
          <p className="text-sm font-medium text-stone-400">No staff members {filter !== "all" ? `with "${filter}" status` : "found"}</p>
          <p className="text-xs text-stone-600">Staff accounts appear here when users sign up. Click any row to manage their ID and verification.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_1.5fr_0.8fr_auto] gap-4 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-600">Name</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-600">Email</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-600">ID status</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-600">Actions</span>
          </div>
          <ul className="divide-y divide-white/[0.04]">
            {filtered.map((user) => {
              const state = user.verificationState ?? "missing";
              const displayName = user.displayName || user.email || "—";
              const initials = displayName.slice(0, 2).toUpperCase();
              return (
                <li key={user.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_1.5fr_0.8fr_auto] gap-4 items-center px-4 py-3 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-blue-300">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                      <p className="text-[11px] text-stone-500 flex items-center gap-1 md:hidden truncate">
                        <Mail className="h-2.5 w-2.5 shrink-0" />{user.email}
                      </p>
                      {user.phone && (
                        <p className="text-[11px] text-stone-600 flex items-center gap-1 truncate">
                          <PhoneIcon className="h-2.5 w-2.5 shrink-0" />{user.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="hidden md:block min-w-0">
                    <p className="text-xs text-stone-400 truncate flex items-center gap-1">
                      <Mail className="h-2.5 w-2.5 text-stone-600 shrink-0" />{user.email}
                    </p>
                    {user.govtIdType && (
                      <p className="text-[11px] text-stone-600 truncate">{ID_TYPE_LABELS[user.govtIdType]}</p>
                    )}
                  </div>
                  <div className="hidden md:block">
                    <VerifBadge state={state} />
                  </div>
                  <button
                    onClick={() => setEditing(user)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 h-8 text-xs font-medium text-stone-300 hover:bg-white/[0.07] hover:text-white transition-all shrink-0"
                  >
                    {state === "verified" ? <ShieldCheck className="h-3 w-3 text-emerald-400" /> : <Edit2 className="h-3 w-3" />}
                    {state === "verified" ? "View" : "Manage ID"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {editing && (
        <StaffModal user={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
