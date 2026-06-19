import { useEffect, useState } from "react";
import { MapPin, Truck, Globe } from "lucide-react";
import { carrierApi, type CarrierDirectoryEntry } from "@/services/carrier";

const CAPACITY_LABELS: Record<string, string> = {
  motorcycle: "Motorcycle",
  van:        "Van",
  truck:      "Truck",
  fleet:      "Fleet",
};

const PRICING_LABELS: Record<string, string> = {
  per_shipment: "Per shipment",
  per_km:       "Per km",
  quoted:       "Quoted",
};

function CarrierCard({ carrier }: { carrier: CarrierDirectoryEntry }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3 hover:border-white/[0.1] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{carrier.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Globe className="h-3 w-3 text-stone-600 shrink-0" />
            <span className="text-xs text-stone-500">{carrier.country?.toUpperCase()}</span>
          </div>
        </div>
        <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-stone-400">
          {CAPACITY_LABELS[carrier.capacityType] ?? carrier.capacityType}
        </span>
      </div>

      {carrier.bio && (
        <p className="text-xs text-stone-500 line-clamp-2">{carrier.bio}</p>
      )}

      {carrier.serviceAreas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {carrier.serviceAreas.slice(0, 5).map((area, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-stone-500"
            >
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              {area.city}{area.state ? `, ${area.state}` : ""}
            </span>
          ))}
          {carrier.serviceAreas.length > 5 && (
            <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-stone-600">
              +{carrier.serviceAreas.length - 5} more
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
        <span className="text-xs text-stone-600">{PRICING_LABELS[carrier.pricingModel] ?? carrier.pricingModel}</span>
        {carrier.pricingModel !== "quoted" && carrier.baseRate > 0 && (
          <span className="text-xs font-medium text-stone-400">
            {carrier.currency} {(carrier.baseRate / 100).toLocaleString()}
          </span>
        )}
        {carrier.frontendUrl && (
          <a
            href={carrier.frontendUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            Visit →
          </a>
        )}
      </div>
    </div>
  );
}

export default function CarrierDirectoryPage() {
  const [carriers, setCarriers] = useState<CarrierDirectoryEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");

  useEffect(() => {
    carrierApi
      .getDirectory()
      .then(setCarriers)
      .catch(() => setError("Could not load carrier directory. Check your OLI API key in settings."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = carriers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.country?.toLowerCase().includes(q) ||
      c.serviceAreas.some(
        (a) => a.city.toLowerCase().includes(q) || a.state.toLowerCase().includes(q)
      )
    );
  });

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 rounded-xl border border-white/[0.06] bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by name, city, or country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none"
        />
        <span className="text-xs text-stone-600 shrink-0">
          {filtered.length} carrier{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] mb-3">
            <Truck className="h-6 w-6 text-stone-600" />
          </div>
          <p className="text-sm font-medium text-stone-400">
            {search ? "No carriers match your search" : "No carriers in the directory yet"}
          </p>
          <p className="text-xs text-stone-600 mt-1">
            {search
              ? "Try a different city or country."
              : "Set up your carrier profile and publish it to be the first."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CarrierCard key={c.operatorId} carrier={c} />
          ))}
        </div>
      )}
    </div>
  );
}
