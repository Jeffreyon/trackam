import { useEffect, useState } from "react";
import { MapPin, Plus, X, Loader2, Trash2, AlertCircle } from "lucide-react";
import { routesApi, ridersApi, type Route, type Rider } from "@/services/logistics";
import { formatNaira } from "@/lib/format";

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    Promise.all([routesApi.list(), ridersApi.list()])
      .then(([r, ri]) => { setRoutes(r); setRiders(ri); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    await routesApi.delete(id);
    load();
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-500">{routes.length} saved route{routes.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 px-3 h-8 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 hover:shadow-orange-500/30 transition-all"
        >
          <Plus className="h-3.5 w-3.5" /> Add route
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0,1,2].map(i => <div key={i} className="h-20 rounded-lg bg-white/[0.03] border border-white/[0.06] animate-pulse" />)}
        </div>
      ) : routes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.03] p-12 text-center">
          <MapPin className="h-8 w-8 text-stone-600 mx-auto mb-3" />
          <p className="text-sm text-stone-400">No routes saved yet.</p>
          <p className="text-xs text-stone-600 mt-1">
            Routes make Quick Dispatch 3x faster — set up your standard lanes once.
          </p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-xs text-orange-400 hover:text-orange-300 transition-colors">
            Add your first route →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {routes.map((route) => (
            <div key={route.id} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{route.name}</p>
                    {route.useCount > 0 && (
                      <span className="text-[11px] text-stone-500 bg-white/[0.06] rounded px-1.5 py-0.5">
                        {route.useCount}x used
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {route.pickupLocation} → {route.deliveryLocation} · {route.distanceKm} km
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-stone-600">
                    {route.defaultRiderName && <span>Rider: <span className="text-stone-300 font-medium">{route.defaultRiderName}</span></span>}
                    {route.defaultRiderFee > 0 && <span>Fee: <span className="text-stone-300 font-medium">{formatNaira(route.defaultRiderFee)}</span></span>}
                    {route.defaultGoodsDescription && <span>Goods: <span className="text-stone-300 font-medium">{route.defaultGoodsDescription}</span></span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(route.id)}
                  className="shrink-0 text-stone-600 hover:text-red-400 transition-colors"
                  title="Remove route"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <AddRouteModal
          riders={riders}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function AddRouteModal({ riders, onClose, onCreated }: { riders: Rider[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", pickupLocation: "", deliveryLocation: "", distanceKm: "",
    defaultRiderId: "", defaultRiderFee: "", defaultGoodsDescription: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await routesApi.create({
        name: form.name,
        pickupLocation: form.pickupLocation,
        deliveryLocation: form.deliveryLocation,
        distanceKm: parseInt(form.distanceKm, 10),
        defaultRiderId: form.defaultRiderId || null,
        defaultRiderFee: form.defaultRiderFee ? parseInt(form.defaultRiderFee, 10) * 100 : 0,
        defaultGoodsDescription: form.defaultGoodsDescription || null,
      } as Parameters<typeof routesApi.create>[0]);
      onCreated();
    } catch {
      setError("Failed to save route. Check the details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 h-9 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative w-full max-w-md rounded-xl bg-[#0c1522] shadow-2xl shadow-black/40 border border-white/[0.08] p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-white">Add route</p>
          <button type="button" onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors"><X className="h-4 w-4" /></button>
        </div>

        {[
          { label: "Route name", key: "name" as const, placeholder: "e.g. Onitsha Run" },
          { label: "Pickup location", key: "pickupLocation" as const, placeholder: "e.g. Balogun Market, Lagos" },
          { label: "Delivery location", key: "deliveryLocation" as const, placeholder: "e.g. Onitsha Main Market" },
          { label: "Distance (km)", key: "distanceKm" as const, placeholder: "e.g. 520" },
          { label: "Default goods", key: "defaultGoodsDescription" as const, placeholder: "e.g. Phone accessories" },
          { label: "Default rider fee (₦)", key: "defaultRiderFee" as const, placeholder: "e.g. 45000" },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-stone-300 mb-1">{label}</label>
            <input
              type={key === "distanceKm" || key === "defaultRiderFee" ? "number" : "text"}
              value={form[key]}
              onChange={set(key)}
              placeholder={placeholder}
              className={inputCls}
            />
          </div>
        ))}

        {riders.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Default rider (optional)</label>
            <select value={form.defaultRiderId} onChange={set("defaultRiderId")} className={inputCls}>
              <option value="" className="bg-[#0c1522]">No default</option>
              {riders.map((r) => <option key={r.id} value={r.id} className="bg-[#0c1522]">{r.name} ({r.vehicleType})</option>)}
            </select>
          </div>
        )}

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
          {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : "Save route"}
        </button>
      </form>
    </div>
  );
}
