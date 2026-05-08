import type { ShipmentStatus, RiskScore } from "@/services/logistics";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ShipmentStatus, string> = {
  pending:     "bg-stone-100 text-stone-600 border-stone-200",
  in_transit:  "bg-blue-50 text-blue-700 border-blue-200",
  delivered:   "bg-green-50 text-green-700 border-green-200",
  failed:      "bg-red-50 text-red-700 border-red-200",
  ghosted:     "bg-orange-50 text-orange-700 border-orange-200",
  handed_over: "bg-purple-50 text-purple-700 border-purple-200",
  disputed:    "bg-rose-50 text-rose-700 border-rose-200",
};

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending:     "Pending",
  in_transit:  "In Transit",
  delivered:   "Delivered",
  failed:      "Failed",
  ghosted:     "Ghosted",
  handed_over: "Handed Over",
  disputed:    "Disputed",
};

const RISK_STYLES: Record<RiskScore, string> = {
  low:    "bg-green-50 text-green-700 border-green-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high:   "bg-red-50 text-red-700 border-red-200",
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
