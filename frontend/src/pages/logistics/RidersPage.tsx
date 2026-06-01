import { useEffect, useState, useMemo } from "react";
import {
  Plus, Users, X, Loader2, AlertCircle, Mail, Phone as PhoneIcon, Edit2,
  Trash2, Search, Bike, Truck, Car,
} from "lucide-react";
import { ridersApi, type Rider, type VehicleType } from "@/services/logistics";
import { formatNaira } from "@/lib/format";
import { PhoneInput } from "@/components/PhoneInput";

const VEHICLE_LABELS: Record<VehicleType, string> = {
  bike: "Bike", tricycle: "Tricycle", van: "Van", truck: "Truck",
};

const VEHICLE_ICONS: Record<VehicleType, React.ComponentType<{ className?: string }>> = {
  bike: Bike, tricycle: Car, van: Truck, truck: Truck,
};

export default function RidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    ridersApi.list().then(setRiders).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return riders;
    return riders.filter((r) =>
      r.name.toLowerCase().includes(q)
      || r.phone.toLowerCase().includes(q)
      || (r.email || "").toLowerCase().includes(q)
      || r.cityCoverage.toLowerCase().includes(q)
    );
  }, [riders, search]);

  async function handleRemove(rider: Rider) {
    if (!window.confirm(`Remove ${rider.name} from your roster? They won't be available for new runs.`)) return;
    setRemovingId(rider.id);
    try {
      await ridersApi.deactivate(rider.id);
      load();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-600" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search riders…"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-9 pr-3 h-9 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors"
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <p className="text-xs text-stone-500 hidden sm:block">
            {riders.length} active rider{riders.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={() => { setEditingRider(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-3 h-9 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 transition-all shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Add rider
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
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
            {riders.length === 0 ? "No riders yet" : "No riders match your search"}
          </p>
          <p className="text-xs text-stone-500">
            {riders.length === 0
              ? "Add the riders you dispatch — their phone and email power custody verification."
              : "Try a different name, phone, or city."}
          </p>
          {riders.length === 0 && (
            <button
              onClick={() => { setEditingRider(null); setShowForm(true); }}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
            >
              <Plus className="h-3 w-3" /> Add your first rider
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((rider) => (
            <RiderCard
              key={rider.id}
              rider={rider}
              removing={removingId === rider.id}
              onEdit={() => { setEditingRider(rider); setShowForm(true); }}
              onRemove={() => handleRemove(rider)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <RiderModal
          rider={editingRider}
          onClose={() => { setShowForm(false); setEditingRider(null); }}
          onSaved={() => { setShowForm(false); setEditingRider(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Rider card ─────────────────────────────────────────────────────────────

function RiderCard({
  rider, removing, onEdit, onRemove,
}: {
  rider: Rider;
  removing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const VehicleIcon = VEHICLE_ICONS[rider.vehicleType];
  const initials = rider.name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 hover:bg-white/[0.05] hover:border-orange-500/20 transition-all group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-orange-300">{initials || "—"}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{rider.name}</p>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-0.5">
              <VehicleIcon className="h-3 w-3 shrink-0" />
              <span>{VEHICLE_LABELS[rider.vehicleType]}</span>
              <span className="text-stone-700">·</span>
              <span className="truncate">{rider.cityCoverage}</span>
            </div>
          </div>
        </div>
        <GhostRateBadge rate={rider.ghostRate} />
      </div>

      <div className="space-y-1 mb-3">
        <p className="text-[11px] text-stone-400 flex items-center gap-1.5">
          <PhoneIcon className="h-2.5 w-2.5 text-stone-600 shrink-0" />
          <span className="font-mono">{rider.phone}</span>
        </p>
        {rider.email && (
          <p className="text-[11px] text-stone-500 flex items-center gap-1.5 truncate">
            <Mail className="h-2.5 w-2.5 text-stone-600 shrink-0" />
            <span className="truncate">{rider.email}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.04]">
        <div className="text-[11px] text-stone-500">
          {rider.totalShipments != null && rider.totalShipments > 0 ? (
            <span>{rider.totalShipments} trip{rider.totalShipments !== 1 ? "s" : ""} · 90d</span>
          ) : (
            <span className="text-stone-600">No trips yet</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {rider.baseFee > 0 && (
            <span className="text-[11px] text-stone-400 font-medium">{formatNaira(rider.baseFee)}</span>
          )}
          <button
            onClick={onEdit}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-500 hover:bg-white/[0.06] hover:text-white transition-colors"
            title="Edit rider"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRemove}
            disabled={removing}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-500 hover:bg-red-500/[0.1] hover:text-red-400 transition-colors disabled:opacity-40"
            title="Remove rider"
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function GhostRateBadge({ rate }: { rate: number | null }) {
  if (rate === null || rate === undefined) {
    return <span className="text-[10px] text-stone-600 font-medium uppercase tracking-wide">New</span>;
  }
  const tone = rate > 20
    ? { bg: "bg-red-500/[0.1]", border: "border-red-500/20", text: "text-red-400" }
    : rate > 10
    ? { bg: "bg-orange-500/[0.1]", border: "border-orange-500/20", text: "text-orange-400" }
    : { bg: "bg-emerald-500/[0.1]", border: "border-emerald-500/20", text: "text-emerald-400" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${tone.bg} ${tone.border} ${tone.text} px-2 py-0.5 text-[10px] font-semibold tabular-nums`}>
      {rate}% ghost
    </span>
  );
}

// ── Create / edit modal ───────────────────────────────────────────────────

const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors";

function RiderModal({
  rider, onClose, onSaved,
}: {
  rider: Rider | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(rider);
  const [form, setForm] = useState({
    name:        rider?.name ?? "",
    phone:       rider?.phone ?? "",
    email:       rider?.email ?? "",
    vehicleType: rider?.vehicleType ?? ("bike" as VehicleType),
    cityCoverage: rider?.cityCoverage ?? "",
    baseFee:     rider ? String(Math.round(rider.baseFee / 100)) : "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<"phone" | "email" | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldError(null);
    try {
      const payload = {
        name:         form.name.trim(),
        phone:        form.phone,
        email:        form.email.trim(),
        vehicleType:  form.vehicleType,
        cityCoverage: form.cityCoverage.trim(),
        baseFee:      form.baseFee ? parseInt(form.baseFee, 10) * 100 : 0,
      };
      if (isEdit && rider) {
        await ridersApi.update(rider.id, payload);
      } else {
        await ridersApi.create(payload);
      }
      onSaved();
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: { message?: string; field?: "phone" | "email" } } })?.response;
      setError(resp?.data?.message || "Failed to save rider. Check the details and try again.");
      if (resp?.data?.field) setFieldError(resp.data.field);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-xl bg-[#0c1522] shadow-2xl shadow-black/40 border border-white/[0.08] overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Users className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{isEdit ? "Edit rider" : "Add rider"}</p>
              <p className="text-[11px] text-stone-500">
                {isEdit ? "Update this rider's contact details and assignment." : "Add a rider to your dispatch roster."}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Full name</label>
            <input
              type="text"
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Ibrahim Musa"
              required
              autoFocus
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Phone</label>
            <PhoneInput
              value={form.phone}
              onChange={(v) => { setForm((f) => ({ ...f, phone: v })); setFieldError(null); }}
              placeholder="8012345678"
              required
            />
            {fieldError === "phone" && (
              <p className="text-[11px] text-red-400 mt-1">{error}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setFieldError(null); }}
              placeholder="rider@example.com"
              className={inputCls}
              required
            />
            <p className="text-[10px] text-stone-600 mt-1">Used to deliver custody codes if SMS is unavailable.</p>
            {fieldError === "email" && (
              <p className="text-[11px] text-red-400 mt-1">{error}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Vehicle</label>
              <select value={form.vehicleType} onChange={set("vehicleType")} className={inputCls}>
                <option value="bike" className="bg-[#0c1522]">Bike</option>
                <option value="tricycle" className="bg-[#0c1522]">Tricycle (Keke)</option>
                <option value="van" className="bg-[#0c1522]">Van</option>
                <option value="truck" className="bg-[#0c1522]">Truck</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Base fee (₦)</label>
              <input
                type="number"
                value={form.baseFee}
                onChange={set("baseFee")}
                placeholder="e.g. 45000"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">City coverage</label>
            <input
              type="text"
              value={form.cityCoverage}
              onChange={set("cityCoverage")}
              placeholder="e.g. Lagos, Onitsha"
              required
              className={inputCls}
            />
          </div>

          {error && !fieldError && (
            <p className="flex items-start gap-1.5 text-xs text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span>{error}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-white/[0.06] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 h-9 text-xs font-medium text-stone-400 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 h-9 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-60 transition-all"
          >
            {submitting
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {isEdit ? "Saving…" : "Adding…"}</>
              : (isEdit ? "Save changes" : "Add rider")}
          </button>
        </div>
      </form>
    </div>
  );
}
