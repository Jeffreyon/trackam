import { useState, useRef, useEffect } from "react";
import { Package, Github, Menu, X, Search, Loader2, FileText, LayoutDashboard, ShieldCheck } from "lucide-react";
import { publicWaybillApi } from "@/services/handover";
import { getAuthToken } from "@/lib/authToken";

const NAV_LINKS = [
  { href: "/waybill",  label: "Generate Waybill", icon: FileText },
  { href: "/handover", label: "Handover",         icon: ShieldCheck },
];

export function PublicNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [trackQuery, setTrackQuery] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSignedIn = Boolean(getAuthToken());

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setTrackError("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [searchOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    const q = trackQuery.trim().toUpperCase();
    if (!q) return;
    setTrackLoading(true);
    setTrackError("");
    try {
      if (q.startsWith("WB-")) {
        const waybill = await publicWaybillApi.lookup(q);
        window.location.href = `/track/${waybill.id}`;
      } else {
        window.location.href = `/track/${q}`;
      }
    } catch {
      setTrackError("Waybill not found. Check the number and try again.");
      setTrackLoading(false);
    }
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50 px-4 pt-3">
      <nav
        className={[
          "max-w-6xl mx-auto rounded-2xl px-4 transition-all duration-300",
          scrolled
            ? "bg-[#0a1628]/80 border border-white/[0.08] shadow-lg shadow-black/20 backdrop-blur-xl"
            : "bg-transparent border border-transparent",
        ].join(" ")}
      >
        <div className="flex items-center justify-between h-12 gap-4">

          {/* Logo */}
          <a href="/" className="flex items-center gap-2 shrink-0 md:w-56 whitespace-nowrap">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Package className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-[13px] font-bold tracking-tight text-white">Trackam</span>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-stone-400 hover:text-white rounded-lg transition-colors"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </a>
            ))}

            {/* Track Package — inline search */}
            <div ref={searchRef} className="relative">
              <button
                onClick={() => { setSearchOpen((v) => !v); setTrackError(""); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-stone-400 hover:text-white rounded-lg transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                Track Package
              </button>

              {searchOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 bg-[#0c1522]/95 border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 backdrop-blur-xl p-3 space-y-2">
                  <p className="text-[11px] text-stone-500 font-medium">Enter waybill number or ID</p>
                  <form onSubmit={handleTrack} className="flex gap-2">
                    <input
                      ref={inputRef}
                      value={trackQuery}
                      onChange={(e) => setTrackQuery(e.target.value)}
                      placeholder="WB-20250507-XXXXXX"
                      className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 h-8 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={trackLoading || !trackQuery.trim()}
                      className="rounded-lg bg-orange-500 hover:bg-orange-600 px-3 h-8 text-xs font-semibold text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {trackLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Go"}
                    </button>
                  </form>
                  {trackError && <p className="text-[11px] text-red-400">{trackError}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-2 shrink-0 w-56 justify-end whitespace-nowrap">
            <a
              href="https://github.com/Jeffreyon/trackam"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-stone-500 hover:text-white transition-colors"
              title="View on GitHub"
            >
              <Github className="h-3.5 w-3.5" />
            </a>
            {isSignedIn ? (
              <a
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white px-3.5 h-8 text-[12px] font-semibold shadow-sm shadow-orange-500/20 transition-all"
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
              </a>
            ) : (
              <>
                <a
                  href="/auth/login"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-stone-400 hover:text-white rounded-lg transition-colors"
                >
                  Log in
                </a>
                <a
                  href="/auth/signup"
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white px-3.5 h-8 text-[12px] font-semibold shadow-sm shadow-orange-500/20 transition-all"
                >
                  Sign up
                </a>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden text-stone-400 hover:text-white transition-colors p-1"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden max-w-6xl mx-auto mt-2 rounded-2xl border border-white/[0.08] bg-[#0a1628]/95 backdrop-blur-xl px-4 py-4 space-y-1 shadow-2xl shadow-black/40">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-stone-300 hover:text-white hover:bg-white/[0.05] rounded-xl transition-colors"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </a>
          ))}

          {/* Mobile track search */}
          <form onSubmit={handleTrack} className="px-3 pt-2 pb-1">
            <p className="text-[11px] text-stone-500 mb-1.5 font-medium">Track a package</p>
            <div className="flex gap-2">
              <input
                value={trackQuery}
                onChange={(e) => setTrackQuery(e.target.value)}
                placeholder="Waybill number..."
                className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 h-9 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-orange-500/40 font-mono"
              />
              <button
                type="submit"
                disabled={trackLoading || !trackQuery.trim()}
                className="rounded-lg bg-orange-500 hover:bg-orange-600 px-4 h-9 text-sm font-semibold text-white transition-colors disabled:opacity-50"
              >
                {trackLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Go"}
              </button>
            </div>
            {trackError && <p className="text-[11px] text-red-400 mt-1">{trackError}</p>}
          </form>

          <div className="border-t border-white/[0.06] pt-3 mt-2 flex items-center gap-3">
            <a
              href="https://github.com/Jeffreyon/trackam"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-white transition-colors"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
            {isSignedIn ? (
              <a
                href="/dashboard"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 text-white h-9 text-sm font-semibold shadow-sm shadow-orange-500/20 transition-all"
              >
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </a>
            ) : (
              <>
                <a
                  href="/auth/login"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.06] text-white h-9 text-sm font-medium transition-all"
                >
                  Log in
                </a>
                <a
                  href="/auth/signup"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 text-white h-9 text-sm font-semibold shadow-sm shadow-orange-500/20 transition-all"
                >
                  Sign up
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
