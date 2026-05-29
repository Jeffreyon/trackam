import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight, Terminal, Copy, Check, Shield, Truck, FileText,
  Package, Ghost, Wallet, BarChart3, Users, Clock,
  Github, Zap, Lock, Globe, Sparkles
} from "lucide-react";
import { PublicNav } from "@/components/layout/PublicNav";

const INSTALL_CMD_WIN = `irm https://raw.githubusercontent.com/Jeffreyon/trackam/main/cli/install.ps1 | iex`;
const INSTALL_CMD_UNIX = `curl -fsSL https://raw.githubusercontent.com/Jeffreyon/trackam/main/cli/install.sh | bash`;

// ── Animated section wrapper ──────────────────────────────────────────────

function FadeIn({ children, className = "", delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="shrink-0 p-2 rounded-lg hover:bg-white/10 transition-all text-stone-500 hover:text-white"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

// ── Install command block ─────────────────────────────────────────────────

function InstallBlock({ compact = false }: { compact?: boolean }) {
  const [tab, setTab] = useState<"windows" | "mac">("windows");
  const cmd = tab === "windows" ? INSTALL_CMD_WIN : INSTALL_CMD_UNIX;
  return (
    <div className="w-full max-w-2xl mx-auto group">
      {/* Glow behind the block */}
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-orange-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="relative rounded-xl border border-white/[0.08] bg-[#0c1522] shadow-2xl overflow-hidden backdrop-blur-sm">
          {/* Fake traffic lights + tab bar */}
          <div className="flex items-center border-b border-white/[0.06] px-4 py-0">
            <div className="flex items-center gap-1.5 mr-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
            </div>
            <button
              onClick={() => setTab("windows")}
              className={`px-3 py-3 text-[11px] font-medium transition-colors border-b-2 -mb-px ${tab === "windows" ? "text-white border-orange-500" : "text-stone-600 border-transparent hover:text-stone-400"}`}
            >
              PowerShell
            </button>
            <button
              onClick={() => setTab("mac")}
              className={`px-3 py-3 text-[11px] font-medium transition-colors border-b-2 -mb-px ${tab === "mac" ? "text-white border-orange-500" : "text-stone-600 border-transparent hover:text-stone-400"}`}
            >
              Mac / Linux
            </button>
          </div>
          {/* Command */}
          <div className="flex items-start gap-3 px-4 py-4">
            <span className="text-orange-500/70 text-sm font-mono mt-0.5 select-none">$</span>
            <code className="flex-1 text-[13px] text-emerald-400/90 font-mono break-all leading-relaxed select-all">{cmd}</code>
            <CopyButton text={cmd} />
          </div>
        </div>
      </div>
      {!compact && (
        <p className="text-center text-xs text-stone-600 mt-3">
          Then run: <code className="text-stone-400 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/[0.06]">trackam setup</code> — zero config, fully automatic
        </p>
      )}
    </div>
  );
}

// ── Dot grid background ───────────────────────────────────────────────────

function DotGrid() {
  return (
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#060d18] text-white">
      <PublicNav />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background layers */}
        <DotGrid />
        {/* Gradient orbs */}
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] bg-orange-500/[0.07] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-[10%] right-[5%] w-[400px] h-[400px] bg-amber-500/[0.05] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[40%] w-[500px] h-[500px] bg-orange-600/[0.04] rounded-full blur-[140px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-5 pt-24 sm:pt-32 pb-28 sm:pb-36">
          {/* Badge */}
          <FadeIn className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/[0.08] px-4 py-1.5 text-[12px] font-medium text-stone-300 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-orange-400" />
              Open source logistics infrastructure
            </div>
          </FadeIn>

          {/* Headline */}
          <FadeIn delay={0.1}>
            <h1 className="text-center mt-8 text-[clamp(2.25rem,6vw,4.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
              <span className="block">Stop losing shipments.</span>
              <span className="block bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                Prove every handoff.
              </span>
            </h1>
          </FadeIn>

          {/* Subhead */}
          <FadeIn delay={0.2}>
            <p className="text-center text-stone-400 mt-6 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed font-light">
              Cryptographic proof of custody at every transfer. Ghost detection.
              Cost tracking. One command to install — runs on your machine.
            </p>
          </FadeIn>

          {/* Install block */}
          <FadeIn delay={0.3} className="mt-12">
            <InstallBlock />
          </FadeIn>

          {/* CTA buttons */}
          <FadeIn delay={0.4}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <a href="/auth/signup" className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 text-white px-6 h-12 text-sm font-semibold shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all hover:scale-[1.02]">
                Sign up on this instance <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a href="https://github.com/Jeffreyon/trackam" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] text-stone-300 hover:text-white px-6 h-12 text-sm font-medium transition-all backdrop-blur-sm">
                <Github className="h-4 w-4" /> View on GitHub
              </a>
            </div>
          </FadeIn>

          {/* Social proof strip */}
          <FadeIn delay={0.5}>
            <div className="flex items-center justify-center gap-6 mt-12 text-[13px] text-stone-500">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500/70" /> Free forever</span>
              <span className="hidden sm:flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500/70" /> Self-hosted</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500/70" /> 2 min setup</span>
              <span className="hidden sm:flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500/70" /> MIT licensed</span>
            </div>
          </FadeIn>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#060d18] to-transparent pointer-events-none" />
      </section>

      {/* ── Problem ───────────────────────────────────────────────────── */}
      <section className="py-24 px-5 relative">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <p className="text-xs font-semibold text-orange-500 uppercase tracking-[0.2em] mb-4">The problem</p>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
              Your riders pick up goods.{" "}
              <span className="text-stone-500">Then silence.</span>
            </h2>
            <p className="text-stone-400 mt-4 text-base max-w-xl leading-relaxed">
              No proof of pickup. No proof of delivery. When goods go missing, it's your word against theirs.
              You eat the loss, or spend days chasing riders who've gone dark.
            </p>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
            <FadeIn delay={0}>
              <ProblemCard icon={<Ghost className="h-5 w-5" />} stat="1 in 8" label="shipments ghosted" description="Riders go silent after pickup. No update for hours. You don't know if goods are delivered or stolen." />
            </FadeIn>
            <FadeIn delay={0.1}>
              <ProblemCard icon={<Wallet className="h-5 w-5" />} stat="Millions" label="lost per year" description="Lost goods, unrecovered logistics costs, disputed deliveries. It compounds every month." />
            </FadeIn>
            <FadeIn delay={0.2}>
              <ProblemCard icon={<Clock className="h-5 w-5" />} stat="Hours" label="chasing updates" description="Calling riders, checking WhatsApp. Manual tracking that doesn't scale past 10 shipments a day." />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section className="py-24 px-5 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto relative">
          <FadeIn>
            <p className="text-xs font-semibold text-orange-500 uppercase tracking-[0.2em] mb-4">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
              Running in 10 minutes.{" "}
              <span className="text-stone-500">Dispatching in 15.</span>
            </h2>
          </FadeIn>
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { n: 1, title: "Install", desc: "Paste one command. Database, backend, frontend — everything is automatic.", icon: Terminal },
              { n: 2, title: "Sign up", desc: "Create your account. OLI Switch operator registration happens behind the scenes.", icon: Users },
              { n: 3, title: "Activate", desc: "Receive your API key by email after approval. Paste it in Settings.", icon: Zap },
              { n: 4, title: "Dispatch", desc: "Claim waybills, build runs, hand over with cryptographic proof at every step.", icon: Truck },
            ].map((step, i) => (
              <FadeIn key={step.n} delay={i * 0.1}>
                <div className="group relative">
                  {/* Connection line */}
                  {step.n < 4 && (
                    <div className="hidden lg:block absolute top-6 left-[calc(100%+4px)] w-[calc(100%-8px)] h-px bg-gradient-to-r from-white/10 to-transparent" />
                  )}
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-500/5 border border-orange-500/10 flex items-center justify-center mb-4 group-hover:border-orange-500/30 transition-colors">
                    <step.icon className="h-5 w-5 text-orange-400" />
                  </div>
                  <div className="text-[11px] font-bold text-orange-500/60 uppercase tracking-widest mb-1.5">Step {step.n}</div>
                  <p className="text-sm font-semibold text-white mb-1">{step.title}</p>
                  <p className="text-[13px] text-stone-400 leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features (bento grid) ─────────────────────────────────────── */}
      <section className="py-24 px-5 relative">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <p className="text-xs font-semibold text-orange-500 uppercase tracking-[0.2em] mb-4">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
              Everything an ops manager needs.{" "}
              <span className="text-stone-500">Nothing they don't.</span>
            </h2>
          </FadeIn>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FadeIn delay={0}>
              <BentoCard icon={<Shield className="h-5 w-5" />} gradient="from-purple-500/20 to-purple-500/5" title="Proof of Handover" description="SHA-256 hash at every custody transfer. Government ID captured. Immutable receipt you can use in disputes." />
            </FadeIn>
            <FadeIn delay={0.05}>
              <BentoCard icon={<FileText className="h-5 w-5" />} gradient="from-orange-500/20 to-orange-500/5" title="Digital Waybills" description="QR-coded waybills generated in seconds. Track any package by scanning the code or entering the waybill number." />
            </FadeIn>
            <FadeIn delay={0.1}>
              <BentoCard icon={<Truck className="h-5 w-5" />} gradient="from-blue-500/20 to-blue-500/5" title="Dispatch Runs" description="Group shipments into runs. Assign riders. Dispatch batches with one click and track the full trip." />
            </FadeIn>
            <FadeIn delay={0.15}>
              <BentoCard icon={<Ghost className="h-5 w-5" />} gradient="from-red-500/20 to-red-500/5" title="Ghost Detection" description="Automatic alerts when riders go silent. Configurable threshold. See ghost rate trends per rider over time." />
            </FadeIn>
            <FadeIn delay={0.2}>
              <BentoCard icon={<Users className="h-5 w-5" />} gradient="from-emerald-500/20 to-emerald-500/5" title="Rider Management" description="Track performance per rider — delivery rate, ghost rate, total shipments handled. Know who you can trust." />
            </FadeIn>
            <FadeIn delay={0.25}>
              <BentoCard icon={<BarChart3 className="h-5 w-5" />} gradient="from-stone-500/20 to-stone-500/5" title="Cost Tracking" description="Fuel cost per trip. Total logistics spend. Value at risk. Monthly loss reporting. Know where your money goes." />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Trust / Open Source ────────────────────────────────────────── */}
      <section className="py-24 px-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.03] via-transparent to-transparent pointer-events-none" />
        <DotGrid />
        <div className="max-w-3xl mx-auto text-center relative">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
              Open source. Self-hosted.{" "}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">Your data stays yours.</span>
            </h2>
            <p className="text-stone-400 mt-5 text-base max-w-xl mx-auto leading-relaxed">
              Trackam runs on your machine. Your shipment data never touches our servers.
              The code is open — audit it, fork it, extend it.
            </p>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 text-left">
            <FadeIn delay={0}>
              <TrustCard icon={<Lock className="h-5 w-5" />} title="Self-hosted" description="Your database, your machine. No vendor lock-in. Export everything anytime." />
            </FadeIn>
            <FadeIn delay={0.1}>
              <TrustCard icon={<Globe className="h-5 w-5" />} title="GS1 EPCIS standard" description="Built on international supply chain standards. Interoperable with any compliant system." />
            </FadeIn>
            <FadeIn delay={0.2}>
              <TrustCard icon={<Github className="h-5 w-5" />} title="MIT licensed" description="Free to use, modify, and distribute. Read every line of code on GitHub." />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="py-28 px-5 relative overflow-hidden">
        <div className="absolute top-[20%] left-[30%] w-[500px] h-[500px] bg-orange-500/[0.05] rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
              Ready to stop guessing<br />where your goods are?
            </h2>
            <p className="text-stone-400 mt-4 text-lg">
              Open your terminal. One command. Dispatching in 15 minutes.
            </p>
          </FadeIn>
          <FadeIn delay={0.1} className="mt-10">
            <InstallBlock />
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-stone-500">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500/70" /> Free forever</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500/70" /> No credit card</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500/70" /> 2 minute setup</span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] px-5 py-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Package className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">Trackam</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-stone-500">
            <a href="/waybill" className="hover:text-white transition-colors">Generate Waybill</a>
            <a href="https://github.com/Jeffreyon/trackam" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
            <span className="text-stone-600">Powered by OLI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Subcomponents ──────────────────────────────────────────────────────── */

function ProblemCard({ icon, stat, label, description }: {
  icon: React.ReactNode; stat: string; label: string; description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className="text-orange-400">{icon}</div>
        <div>
          <span className="text-2xl font-bold text-white">{stat}</span>
          <span className="text-xs text-stone-500 ml-2">{label}</span>
        </div>
      </div>
      <p className="text-[13px] text-stone-400 leading-relaxed">{description}</p>
    </div>
  );
}

function BentoCard({ icon, gradient, title, description }: {
  icon: React.ReactNode; gradient: string; title: string; description: string;
}) {
  return (
    <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
      <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${gradient} border border-white/[0.06] flex items-center justify-center mb-4 text-white/80 group-hover:text-white transition-colors`}>
        {icon}
      </div>
      <p className="text-sm font-semibold text-white mb-1.5">{title}</p>
      <p className="text-[13px] text-stone-400 leading-relaxed">{description}</p>
    </div>
  );
}

function TrustCard({ icon, title, description }: {
  icon: React.ReactNode; title: string; description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
      <div className="text-orange-400 mb-3">{icon}</div>
      <p className="text-sm font-semibold text-white mb-1">{title}</p>
      <p className="text-[13px] text-stone-400 leading-relaxed">{description}</p>
    </div>
  );
}
