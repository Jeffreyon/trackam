import { useEffect, useState } from "react";
import { MapPin, Truck, ExternalLink, Zap } from "lucide-react";
import { carrierApi, type CarrierDirectoryEntry } from "@/services/carrier";
import DispatchRunModal from "@/components/logistics/DispatchRunModal";

const CAPACITY_CONFIG: Record<string, { label: string; color: string; ring: string; dot: string }> = {
  motorcycle: { label: "Motorcycle", color: "text-orange-400",  ring: "ring-orange-500/25",  dot: "bg-orange-500" },
  van:        { label: "Van",        color: "text-sky-400",     ring: "ring-sky-500/25",     dot: "bg-sky-500" },
  truck:      { label: "Truck",      color: "text-violet-400",  ring: "ring-violet-500/25",  dot: "bg-violet-500" },
  fleet:      { label: "Fleet",      color: "text-emerald-400", ring: "ring-emerald-500/25", dot: "bg-emerald-500" },
};

const PRICING_LABELS: Record<string, string> = {
  per_shipment: "Per shipment",
  per_km:       "Per km",
  quoted:       "Quoted",
};

const SPEC_COLORS = [
  "text-amber-400 bg-amber-500/[0.1] ring-amber-500/20",
  "text-cyan-400 bg-cyan-500/[0.1] ring-cyan-500/20",
  "text-pink-400 bg-pink-500/[0.1] ring-pink-500/20",
  "text-indigo-400 bg-indigo-500/[0.1] ring-indigo-500/20",
  "text-teal-400 bg-teal-500/[0.1] ring-teal-500/20",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

function LogoOrAvatar({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  const [imgErr, setImgErr] = useState(false);

  if (logoUrl && !imgErr) {
    return (
      <img
        src={logoUrl}
        alt={name}
        onError={() => setImgErr(true)}
        className="flex-shrink-0 h-10 w-10 rounded-lg object-cover ring-1 ring-white/10"
      />
    );
  }

  return (
    <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-700/10 flex items-center justify-center ring-1 ring-orange-500/20">
      <span className="text-[11px] font-bold text-orange-300 tracking-wide">{initials(name)}</span>
    </div>
  );
}

function FlagImg({ code }: { code: string }) {
  const [err, setErr] = useState(false);
  if (err) return <span className="text-[9px] font-bold text-stone-600 uppercase">{code.slice(0, 2)}</span>;
  return (
    <img
      src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
      alt=""
      onError={() => setErr(true)}
      className="h-3 w-[18px] object-cover rounded-[2px] shrink-0"
    />
  );
}

function CarrierCard({ carrier, onBook }: { carrier: CarrierDirectoryEntry; onBook: (c: CarrierDirectoryEntry) => void }) {
  const cap = CAPACITY_CONFIG[carrier.capacityType] ?? {
    label: carrier.capacityType,
    color: "text-stone-400",
    ring: "ring-white/10",
    dot: "bg-stone-500",
  };

  return (
    <div className="group rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-4 flex flex-col gap-3 hover:border-white/[0.1] hover:from-white/[0.05] transition-all">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <LogoOrAvatar logoUrl={carrier.logoUrl} name={carrier.name} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate leading-tight">{carrier.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <FlagImg code={carrier.country ?? "ng"} />
            <span className="text-[11px] text-stone-500 uppercase">{carrier.country}</span>
            {carrier.fleetSize != null && (
              <>
                <span className="text-stone-700">·</span>
                <Truck className="h-2.5 w-2.5 text-stone-600 shrink-0" />
                <span className="text-[11px] text-stone-500">{carrier.fleetSize} vehicles</span>
              </>
            )}
          </div>
        </div>
        <span className={`shrink-0 flex items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium ring-1 ${cap.ring} ${cap.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cap.dot} opacity-80`} />
          {cap.label}
        </span>
      </div>

      {/* ── Specializations ── */}
      {carrier.specializations && carrier.specializations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {carrier.specializations.slice(0, 5).map((s, i) => (
            <span key={s} className={`rounded-md px-2 py-0.5 text-[10px] font-medium ring-1 ${SPEC_COLORS[i % SPEC_COLORS.length]}`}>
              {s}
            </span>
          ))}
        </div>
      )}

      {/* ── Bio ── */}
      {carrier.bio && (
        <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">{carrier.bio}</p>
      )}

      {/* ── Coverage ── */}
      {carrier.serviceAreas.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-stone-700 font-semibold">Coverage</p>
          <div className="flex flex-wrap gap-1.5">
            {carrier.serviceAreas.slice(0, 6).map((area, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-stone-500"
              >
                <FlagImg code={area.country ?? carrier.country ?? "ng"} />
                <MapPin className="h-2.5 w-2.5 shrink-0 text-stone-700" />
                {area.city}{area.state ? `, ${area.state}` : ""}
              </span>
            ))}
            {carrier.serviceAreas.length > 6 && (
              <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-stone-600">
                +{carrier.serviceAreas.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] mt-auto">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-stone-600">{PRICING_LABELS[carrier.pricingModel] ?? carrier.pricingModel}</span>
          {carrier.pricingModel !== "quoted" && carrier.baseRate > 0 && (
            <span className="text-[11px] font-medium text-stone-400">
              · {carrier.currency} {(carrier.baseRate / 100).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {carrier.frontendUrl && (
            <a
              href={carrier.frontendUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-300 transition-colors"
            >
              Visit <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          <button
            onClick={() => onBook(carrier)}
            className="flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-[11px] font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <Truck className="h-2.5 w-2.5" /> Dispatch run
          </button>
        </div>
      </div>
    </div>
  );
}

type CarrierFilter = "all" | "trackam" | "integrated";

const INTEGRATED_CARRIER_IDS = ["dhl_express", "aramex", "ups", "fedex"];

export default function CarrierDirectoryPage() {
  const [carriers, setCarriers] = useState<CarrierDirectoryEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState<CarrierFilter>("all");
  const [bookingCarrier, setBookingCarrier] = useState<CarrierDirectoryEntry | null>(null);

  useEffect(() => {
    carrierApi
      .getDirectory()
      .then(setCarriers)
      .catch(() => setError("Could not load carrier directory. Check your OLI API key in settings."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = carriers.filter((c) => {
    const isIntegrated = INTEGRATED_CARRIER_IDS.includes(c.operatorId);
    if (typeFilter === "trackam"    && isIntegrated)  return false;
    if (typeFilter === "integrated" && !isIntegrated) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.country?.toLowerCase().includes(q) ||
      c.serviceAreas.some((a) => a.city.toLowerCase().includes(q) || a.state?.toLowerCase().includes(q)) ||
      c.specializations?.some((s) => s.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl border border-white/[0.06] bg-white/[0.03] animate-pulse" />
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
      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 self-start">
          {(["all", "trackam", "integrated"] as CarrierFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={["rounded-lg px-3 h-7 text-xs font-medium transition-all flex items-center gap-1.5",
                typeFilter === f
                  ? "bg-white/[0.08] text-white shadow-sm shadow-black/20"
                  : "text-stone-500 hover:text-stone-300"].join(" ")}
            >
              {f === "trackam" && <Truck className="h-3 w-3" />}
              {f === "integrated" && <Zap className="h-3 w-3" />}
              {f === "all" ? "All carriers" : f === "trackam" ? "Trackam network" : "Integrated"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search name, city, specialization…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-56 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-orange-500/50 focus:outline-none"
          />
          <span className="text-xs text-stone-600 shrink-0 hidden sm:block">
            {filtered.length} carrier{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] mb-3">
            <Truck className="h-6 w-6 text-stone-600" />
          </div>
          <p className="text-sm font-medium text-stone-400">
            {search || typeFilter !== "all" ? "No carriers match your filter" : "No carriers in the directory yet"}
          </p>
          <p className="text-xs text-stone-600 mt-1">
            {search || typeFilter !== "all"
              ? "Try a different search or switch to All carriers."
              : "Set up your carrier profile and publish it to be the first."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CarrierCard key={c.operatorId} carrier={c} onBook={setBookingCarrier} />
          ))}
        </div>
      )}

      {bookingCarrier && (
        <DispatchRunModal
          carrier={bookingCarrier}
          onClose={() => setBookingCarrier(null)}
        />
      )}
    </div>
  );
}
