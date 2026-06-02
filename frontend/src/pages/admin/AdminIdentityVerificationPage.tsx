import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck, ShieldAlert, Loader2, X, Phone as PhoneIcon, Mail,
  ZoomIn, Inbox, User as UserIcon, Bike,
} from "lucide-react";
import {
  ridersApi, type Rider, type GovtIdType,
} from "@/services/logistics";
import {
  fetchStaffPendingVerification, fetchUserWithPhoto, verifyStaff, rejectStaff,
  type AdminUser,
} from "@/services/admin.api";

const ID_TYPE_LABELS: Record<GovtIdType, string> = {
  nin: "NIN",
  voters_card: "Voter's Card",
  passport: "International Passport",
  drivers_license: "Driver's License",
};

type Kind = "rider" | "staff";
type PendingItem =
  | { kind: "rider"; rider: Rider }
  | { kind: "staff"; user: AdminUser };

function itemId(item: PendingItem): string {
  return item.kind === "rider" ? item.rider.id : item.user.id;
}

export default function AdminIdentityVerificationPage() {
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PendingItem | null>(null);
  const [filter, setFilter] = useState<"all" | Kind>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [riderRows, staffRows] = await Promise.all([
        ridersApi.pendingVerification().catch(() => []),
        fetchStaffPendingVerification().catch(() => []),
      ]);
      const items: PendingItem[] = [
        ...riderRows.map((r): PendingItem => ({ kind: "rider", rider: r })),
        ...staffRows.map((u): PendingItem => ({ kind: "staff", user: u })),
      ];
      setPending(items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function onDecision(updatedId: string) {
    setPending((prev) => prev.filter((p) => itemId(p) !== updatedId));
    setSelected(null);
  }

  const filtered = pending.filter((p) => filter === "all" || p.kind === filter);
  const riderCount = pending.filter((p) => p.kind === "rider").length;
  const staffCount = pending.filter((p) => p.kind === "staff").length;

  if (loading) {
    return (
      <div className="max-w-4xl space-y-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
        ))}
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="max-w-4xl rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-10 text-center">
        <Inbox className="h-8 w-8 text-stone-600 mx-auto mb-3" />
        <p className="text-sm font-medium text-stone-300">No identities awaiting verification</p>
        <p className="text-xs text-stone-500 mt-1">
          New riders and staff will appear here for review after they upload an ID.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-stone-500">
          {pending.length} identit{pending.length === 1 ? "y" : "ies"} awaiting review.
        </p>
        <div className="inline-flex rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5 text-[11px]">
          <FilterTab active={filter === "all"}    onClick={() => setFilter("all")}>All ({pending.length})</FilterTab>
          <FilterTab active={filter === "rider"}  onClick={() => setFilter("rider")}>Riders ({riderCount})</FilterTab>
          <FilterTab active={filter === "staff"}  onClick={() => setFilter("staff")}>Staff ({staffCount})</FilterTab>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((item) => (
          <PendingRow key={`${item.kind}-${itemId(item)}`} item={item} onOpen={() => setSelected(item)} />
        ))}
      </div>

      {selected && (
        <ReviewModal
          item={selected}
          onClose={() => setSelected(null)}
          onDecision={onDecision}
        />
      )}
    </div>
  );
}

function FilterTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
        active ? "bg-white/[0.08] text-white" : "text-stone-500 hover:text-stone-300"
      }`}
    >
      {children}
    </button>
  );
}

function PendingRow({ item, onOpen }: { item: PendingItem; onOpen: () => void }) {
  const name = item.kind === "rider" ? item.rider.name : (item.user.displayName || item.user.email || "Unknown");
  const idType = item.kind === "rider" ? item.rider.govtIdType : item.user.govtIdType;
  const idNumber = item.kind === "rider" ? item.rider.govtIdNumber : item.user.govtIdNumber;
  const initials = name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const Icon = item.kind === "rider" ? Bike : UserIcon;
  const kindLabel = item.kind === "rider" ? "Rider" : "Staff";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] hover:border-orange-500/20 p-4 transition-all text-left group"
    >
      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-orange-300">{initials || "—"}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-white truncate">{name}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-stone-400 shrink-0">
            <Icon className="h-2.5 w-2.5" />{kindLabel}
          </span>
        </div>
        <p className="text-[11px] text-stone-500 truncate">
          {idType && ID_TYPE_LABELS[idType]} · {idNumber || "no number"}
        </p>
      </div>
      <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider shrink-0">
        Pending
      </span>
      <ZoomIn className="h-4 w-4 text-stone-500 group-hover:text-orange-400 transition-colors shrink-0" />
    </button>
  );
}

function ReviewModal({
  item, onClose, onDecision,
}: {
  item: PendingItem;
  onClose: () => void;
  onDecision: (id: string) => void;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [enriched, setEnriched] = useState<PendingItem>(item);

  useEffect(() => {
    let alive = true;
    if (item.kind === "rider") {
      ridersApi.get(item.rider.id, { includePhoto: true })
        .then((r) => { if (alive) setEnriched({ kind: "rider", rider: r }); })
        .catch(() => {});
    } else {
      fetchUserWithPhoto(item.user.id)
        .then((u) => { if (alive) setEnriched({ kind: "staff", user: u }); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [item]);

  async function handleApprove() {
    setBusy("approve");
    setError("");
    try {
      if (item.kind === "rider") {
        await ridersApi.verify(item.rider.id);
        onDecision(item.rider.id);
      } else {
        await verifyStaff(item.user.id);
        onDecision(item.user.id);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Couldn't approve. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectionReason.trim()) return;
    setBusy("reject");
    setError("");
    try {
      if (item.kind === "rider") {
        await ridersApi.reject(item.rider.id, rejectionReason.trim());
        onDecision(item.rider.id);
      } else {
        await rejectStaff(item.user.id, rejectionReason.trim());
        onDecision(item.user.id);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Couldn't reject. Try again.");
    } finally {
      setBusy(null);
    }
  }

  // Unified accessors
  const name = enriched.kind === "rider"
    ? enriched.rider.name
    : (enriched.user.displayName || enriched.user.email || "Unknown");
  const phone = enriched.kind === "rider" ? enriched.rider.phone : enriched.user.phone;
  const email = enriched.kind === "rider" ? enriched.rider.email : enriched.user.email;
  const idType = enriched.kind === "rider" ? enriched.rider.govtIdType : enriched.user.govtIdType;
  const idNumber = enriched.kind === "rider" ? enriched.rider.govtIdNumber : enriched.user.govtIdNumber;
  const photo = enriched.kind === "rider" ? enriched.rider.govtIdPhoto : enriched.user.govtIdPhoto;
  const kindLabel = enriched.kind === "rider" ? "Rider" : "Staff";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl bg-[#0c1522] shadow-2xl shadow-black/50 border border-white/[0.08] overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Verify {kindLabel.toLowerCase()} ID</p>
              <p className="text-[11px] text-stone-500">Compare the photo against the entered details.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 overflow-y-auto">
          <div className="bg-black/30 p-4 flex items-center justify-center min-h-[300px]">
            {photo ? (
              <img
                src={photo}
                alt="Government ID"
                className="max-w-full max-h-[60vh] rounded-lg object-contain"
              />
            ) : (
              <div className="text-center text-stone-600">
                <ShieldAlert className="h-8 w-8 mx-auto mb-2" />
                <p className="text-xs">No photo uploaded</p>
              </div>
            )}
          </div>

          <div className="p-5 space-y-3 border-l border-white/[0.06]">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-600 font-semibold">{kindLabel}</p>
              <p className="text-sm font-semibold text-white mt-0.5">{name}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-600 font-semibold">Contact</p>
              {phone && (
                <p className="text-[11px] text-stone-300 mt-0.5 flex items-center gap-1.5">
                  <PhoneIcon className="h-2.5 w-2.5 text-stone-600" />
                  <span className="font-mono">{phone}</span>
                </p>
              )}
              {email && (
                <p className="text-[11px] text-stone-500 flex items-center gap-1.5">
                  <Mail className="h-2.5 w-2.5 text-stone-600" />
                  {email}
                </p>
              )}
              {!phone && !email && <p className="text-[11px] text-stone-600">—</p>}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-600 font-semibold">ID type</p>
              <p className="text-sm font-medium text-stone-200 mt-0.5">
                {idType ? ID_TYPE_LABELS[idType] : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-600 font-semibold">ID number</p>
              <p className="text-sm font-mono text-stone-200 mt-0.5 break-all">
                {idNumber || "—"}
              </p>
            </div>

            {error && (
              <p className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
                <ShieldAlert className="h-3 w-3 shrink-0 mt-0.5" />{error}
              </p>
            )}

            {showRejectForm ? (
              <form onSubmit={handleReject} className="space-y-2 pt-2">
                <label className="block text-[10px] uppercase tracking-wider text-stone-600 font-semibold">
                  Rejection reason
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Photo is blurry — please re-upload a clearer image of the front of the card."
                  required
                  rows={3}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-red-500/40 transition-colors resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowRejectForm(false); setRejectionReason(""); }}
                    disabled={busy === "reject"}
                    className="flex-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 h-8 text-[11px] font-medium text-stone-400 hover:text-white hover:bg-white/[0.06] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy === "reject" || !rejectionReason.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 h-8 text-[11px] font-semibold text-white disabled:opacity-60 transition-colors"
                  >
                    {busy === "reject"
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Rejecting…</>
                      : "Send rejection"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  disabled={busy !== null}
                  className="flex-none rounded-lg border border-red-500/25 bg-red-500/[0.05] hover:bg-red-500/[0.1] px-3 h-9 text-[11px] font-semibold text-red-300 transition-all disabled:opacity-50"
                >
                  Reject…
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={busy !== null}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 h-9 text-xs font-semibold text-white shadow-sm shadow-emerald-500/20 disabled:opacity-60 transition-all"
                >
                  {busy === "approve"
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Approving…</>
                    : <><ShieldCheck className="h-3.5 w-3.5" /> Approve</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
