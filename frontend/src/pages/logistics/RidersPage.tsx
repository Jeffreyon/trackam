import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Users, X, Loader2 } from "lucide-react";
import { ridersApi, type Rider, type VehicleType } from "@/services/logistics";
import { formatNaira } from "@/lib/format";

const VEHICLE_LABELS: Record<VehicleType, string> = {
  bike: "Bike", tricycle: "Tricycle", van: "Van", truck: "Truck",
};

export default function RidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    ridersApi.list().then(setRiders).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-500">{riders.length} active rider{riders.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-3 h-8 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 transition-all"
        >
          <Plus className="h-3.5 w-3.5" /> Add rider
        </button>
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-stone-500 animate-pulse">Loading…</div>
        ) : riders.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-8 w-8 text-stone-600 mx-auto mb-3" />
            <p className="text-sm text-stone-500">No riders yet.</p>
            <button onClick={() => setShowForm(true)} className="mt-2 text-xs text-orange-400 hover:text-orange-300 transition-colors">
              Add your first rider →
            </button>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-2.5 text-left font-medium text-stone-500">Rider</th>
                <th className="px-4 py-2.5 text-left font-medium text-stone-500 hidden sm:table-cell">Vehicle</th>
                <th className="px-4 py-2.5 text-left font-medium text-stone-500 hidden sm:table-cell">Coverage</th>
                <th className="px-4 py-2.5 text-left font-medium text-stone-500">Ghost rate</th>
                <th className="px-4 py-2.5 text-right font-medium text-stone-500 hidden md:table-cell">Base fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {riders.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/dashboard/riders/${r.id}`} className="font-medium text-stone-200 hover:text-orange-400 transition-colors">
                      {r.name}
                    </Link>
                    <p className="text-[11px] text-stone-600">{r.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-500 hidden sm:table-cell">{VEHICLE_LABELS[r.vehicleType]}</td>
                  <td className="px-4 py-3 text-stone-500 hidden sm:table-cell">{r.cityCoverage}</td>
                  <td className="px-4 py-3">
                    <GhostRateBadge rate={r.ghostRate} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-stone-200 hidden md:table-cell">
                    {r.baseFee ? formatNaira(r.baseFee) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && <AddRiderModal onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function GhostRateBadge({ rate }: { rate: number | null }) {
  if (rate === null || rate === undefined) return <span className="text-stone-600">—</span>;
  const cls = rate > 20 ? "text-red-400 font-semibold" : rate > 10 ? "text-orange-400" : "text-emerald-400";
  return <span className={`text-xs ${cls}`}>{rate}%</span>;
}

function AddRiderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", vehicleType: "bike" as VehicleType, cityCoverage: "", baseFee: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await ridersApi.create({ ...form, baseFee: form.baseFee ? parseInt(form.baseFee, 10) * 100 : 0 });
      onCreated();
    } catch {
      setError("Failed to add rider. Check the details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative w-full max-w-md rounded-xl bg-[#0c1522] shadow-2xl shadow-black/40 border border-white/[0.08] p-5 space-y-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-white">Add rider</p>
          <button type="button" onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors"><X className="h-4 w-4" /></button>
        </div>

        {[
          { label: "Full name", key: "name" as const, placeholder: "e.g. Ibrahim Musa", type: "text" },
          { label: "Phone", key: "phone" as const, placeholder: "e.g. 08012345678", type: "tel" },
          { label: "City coverage", key: "cityCoverage" as const, placeholder: "e.g. Lagos, Onitsha", type: "text" },
          { label: "Base fee (₦)", key: "baseFee" as const, placeholder: "e.g. 45000", type: "number" },
        ].map(({ label, key, placeholder, type }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-stone-300 mb-1">{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={set(key)}
              placeholder={placeholder}
              className={inputCls}
            />
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-stone-300 mb-1">Vehicle type</label>
          <select value={form.vehicleType} onChange={set("vehicleType")} className={inputCls}>
            <option value="bike" className="bg-[#0c1522]">Bike</option>
            <option value="tricycle" className="bg-[#0c1522]">Tricycle (Keke)</option>
            <option value="van" className="bg-[#0c1522]">Van</option>
            <option value="truck" className="bg-[#0c1522]">Truck</option>
          </select>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/[0.1] border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 h-9 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-60 transition-all"
        >
          {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding…</> : "Add rider"}
        </button>
      </form>
    </div>
  );
}
