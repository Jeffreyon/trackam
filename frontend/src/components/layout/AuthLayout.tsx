import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";

type AuthLayoutProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-[#060d18] text-white flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-orange-500/[0.06] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-blue-500/[0.04] rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <header className="mb-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2"
          >
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Package className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              Trackam
            </span>
          </Link>
        </header>

        {/* Card */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#0c1522] px-6 pt-8 pb-6 shadow-2xl shadow-black/30">
          <div className="mb-8 text-center space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="text-sm text-stone-400">{description}</p>
            )}
          </div>
          {children}
        </section>

        {/* Footer */}
        {footer && (
          <div className="mt-4 text-center text-xs text-stone-500">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
