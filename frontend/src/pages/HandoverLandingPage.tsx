import { Truck, Users, ChevronRight, ShieldCheck } from "lucide-react";
import { PublicNav } from "@/components/layout/PublicNav";

const OPTIONS = [
  {
    href: "/handover/driver",
    title: "Driver handover",
    description: "You're a driver or courier handing packages to the next person in the chain.",
    icon: Truck,
    accent: "from-purple-500 to-purple-600",
    iconBg: "bg-purple-500/15",
    iconColor: "text-purple-400",
    borderHover: "hover:border-purple-500/30",
  },
  {
    href: "/handover/staff",
    title: "Staff handover",
    description: "You're warehouse or office staff transferring custody internally within your organization.",
    icon: Users,
    accent: "from-orange-500 to-orange-600",
    iconBg: "bg-orange-500/15",
    iconColor: "text-orange-400",
    borderHover: "hover:border-orange-500/30",
  },
];

export default function HandoverLandingPage() {
  return (
    <div className="min-h-screen bg-[#060d18] text-white flex flex-col">
      <PublicNav />
      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-24 pb-12">
        <div className="w-full max-w-md space-y-8">

          <div className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-white/[0.06] flex items-center justify-center mb-4">
              <ShieldCheck className="h-6 w-6 text-white/60" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Handover</h1>
            <p className="text-sm text-stone-400 max-w-xs mx-auto">
              Select your role to begin transferring custody of packages.
            </p>
          </div>

          <div className="space-y-3">
            {OPTIONS.map(({ href, title, description, icon: Icon, iconBg, iconColor, borderHover }) => (
              <a
                key={href}
                href={href}
                className={[
                  "group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 transition-all duration-200",
                  borderHover,
                  "hover:bg-white/[0.05]",
                ].join(" ")}
              >
                <div className={`shrink-0 h-11 w-11 rounded-lg ${iconBg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">{description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-stone-600 group-hover:text-stone-400 transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
