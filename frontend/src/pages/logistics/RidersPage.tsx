import { useEffect, useState, useMemo } from "react";
import {
  Users, Search, Bike, Truck, Car, ShieldCheck, ShieldAlert, Clock,
  Phone as PhoneIcon, Mail, ExternalLink,
} from "lucide-react";
import { ridersApi, type Rider, type VehicleType, type GovtIdType, type VerificationState } from "@/services/logistics";
import { formatNaira } from "@/lib/format";
import { Link } from "react-router-dom";

const ID_TYPE_LABELS: Record<GovtIdType, string> = {
  nin: "NIN",
  voters_card: "Voter's Card",
  passport: "International Passport",
  drivers_license: "Driver's License",
};

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

  useEffect(() => {
    ridersApi.list().then(setRiders).finally(() => setLoading(false));
  }, []);

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
          <Link
            to="/admin/dashboard/riders"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 h-9 text-xs font-medium text-stone-400 hover:text-white hover:bg-white/[0.06] transition-all shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Manage in admin
          </Link>
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
              ? "Riders are added and managed from the admin dashboard."
              : "Try a different name, phone, or city."}
          </p>
          {riders.length === 0 && (
            <Link
              to="/admin/dashboard/riders"
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
            >
              Go to admin dashboard →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((rider) => (
            <RiderCard key={rider.id} rider={rider} />
          ))}
        </div>
      )}
    </div>
  );
}

function RiderCard({ rider }: { rider: Rider }) {
  const VehicleIcon = VEHICLE_ICONS[rider.vehicleType];
  const initials = rider.name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 hover:bg-white/[0.05] hover:border-orange-500/20 transition-all">
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
        <VerificationBadge state={rider.verificationState} idType={rider.govtIdType} />
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.04]">
        <div className="text-[11px] text-stone-500">
          {rider.totalShipments != null && rider.totalShipments > 0 ? (
            <span>{rider.totalShipments} trip{rider.totalShipments !== 1 ? "s" : ""} · 90d</span>
          ) : (
            <span className="text-stone-600">No trips yet</span>
          )}
        </div>
        {rider.baseFee > 0 && (
          <span className="text-[11px] text-stone-400 font-medium">{formatNaira(rider.baseFee)}</span>
        )}
      </div>
    </div>
  );
}

export function VerificationBadge({
  state, idType,
}: { state: VerificationState; idType: GovtIdType | null }) {
  if (state === "verified") {
    return (
      <p className="text-[10px] flex items-center gap-1 text-emerald-400 font-medium">
        <ShieldCheck className="h-2.5 w-2.5 shrink-0" />
        Verified {idType ? `· ${ID_TYPE_LABELS[idType]}` : ""}
      </p>
    );
  }
  if (state === "pending") {
    return (
      <p className="text-[10px] flex items-center gap-1 text-amber-400 font-medium">
        <Clock className="h-2.5 w-2.5 shrink-0" />
        Awaiting verification {idType ? `· ${ID_TYPE_LABELS[idType]}` : ""}
      </p>
    );
  }
  if (state === "rejected") {
    return (
      <p className="text-[10px] flex items-center gap-1 text-red-400 font-medium">
        <ShieldAlert className="h-2.5 w-2.5 shrink-0" />
        ID rejected — re-upload needed
      </p>
    );
  }
  return (
    <p className="text-[10px] flex items-center gap-1 text-stone-600 font-medium">
      <ShieldAlert className="h-2.5 w-2.5 shrink-0" />
      No ID on file
    </p>
  );
}

export function GhostRateBadge({ rate }: { rate: number | null }) {
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
