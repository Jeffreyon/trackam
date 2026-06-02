import type { ShipmentStatus, RiskScore } from "@/services/logistics";
import { cn } from "@/lib/utils";

export const STATUS_STYLES: Record<ShipmentStatus, string> = {
  pending:     "bg-stone-500/[0.12] text-stone-400 border-stone-500/20",
  in_custody:  "bg-amber-500/[0.1] text-amber-300 border-amber-500/20",
  in_transit:  "bg-blue-500/[0.1] text-blue-400 border-blue-500/20",
  delivered:   "bg-emerald-500/[0.1] text-emerald-400 border-emerald-500/20",
  failed:      "bg-red-500/[0.1] text-red-400 border-red-500/20",
  ghosted:     "bg-orange-500/[0.1] text-orange-400 border-orange-500/20",
  handed_over: "bg-purple-500/[0.1] text-purple-400 border-purple-500/20",
  disputed:    "bg-rose-500/[0.1] text-rose-400 border-rose-500/20",
};

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending:     "Pending",
  in_custody:  "In Custody",
  in_transit:  "In Transit",
  delivered:   "Delivered",
  failed:      "Failed",
  ghosted:     "Ghosted",
  handed_over: "Handed Over",
  disputed:    "Disputed",
};

const RISK_STYLES: Record<RiskScore, string> = {
  low:    "bg-emerald-500/[0.1] text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/[0.1] text-amber-400 border-amber-500/20",
  high:   "bg-red-500/[0.1] text-red-400 border-red-500/20",
};

interface StatusBadgeProps { status: ShipmentStatus; className?: string }
interface RiskBadgeProps   { score: RiskScore;       className?: string }

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
      STATUS_STYLES[status],
      className
    )}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function RiskBadge({ score, className }: RiskBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
      RISK_STYLES[score],
      className
    )}>
      {score} risk
    </span>
  );
}
