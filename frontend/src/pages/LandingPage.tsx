import { useState } from "react";
import {
  ArrowRight, Terminal, Copy, Check, Shield, Truck, FileText,
  Package, Ghost, Wallet, BarChart3, Users, Clock,
  Github, Zap, Lock, Globe
} from "lucide-react";
import { PublicNav } from "@/components/layout/PublicNav";

const INSTALL_CMD_WIN = `irm https://raw.githubusercontent.com/Jeffreyon/trackam/main/cli/install.ps1 | iex`;
const INSTALL_CMD_UNIX = `curl -fsSL https://raw.githubusercontent.com/Jeffreyon/trackam/main/cli/install.sh | bash`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="shrink-0 p-1.5 rounded-md hover:bg-white/10 transition-colors text-stone-400 hover:text-white"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function InstallBlock() {
  const [tab, setTab] = useState<"windows" | "mac">("windows");
  const cmd = tab === "windows" ? INSTALL_CMD_WIN : INSTALL_CMD_UNIX;
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-xl border border-white/10 bg-[#0d1b2a] shadow-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b border-white/10 px-1">
          <button
            onClick={() => setTab("windows")}
            className={`px-4 py-2.5 text-xs font-medium transition-colors ${tab === "windows" ? "text-white border-b-2 border-orange-500" : "text-stone-500 hover:text-stone-300"}`}
          >
            Windows (PowerShell)
          </button>
          <button
            onClick={() => setTab("mac")}
            className={`px-4 py-2.5 text-xs font-medium transition-colors ${tab === "mac" ? "text-white border-b-2 border-orange-500" : "text-stone-500 hover:text-stone-300"}`}
          >
            Mac / Linux
          </button>
        </div>
        {/* Command */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Terminal className="h-4 w-4 text-orange-500 shrink-0" />
          <code className="flex-1 text-sm text-green-400 font-mono break-all leading-relaxed select-all">{cmd}</code>
          <CopyButton text={cmd} />
        </div>
      </div>
      <p className="text-center text-xs text-stone-500 mt-3">
        Then run: <code className="text-stone-400 font-mono bg-stone-800/50 px-1.5 py-0.5 rounded">trackam setup</code>
      </p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <PublicNav />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="bg-[#0a1628] text-white pt-20 pb-24 px-5">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 px-3 py-1 text-[11px] font-medium text-orange-400 mb-6">
            <Zap className="h-3 w-3" />
            Free &amp; open source — install in 2 minutes
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.1] tracking-tight">
            Stop losing shipments.<br />
            <span className="text-orange-500">Start proving every handoff.</span>
          </h1>
          <p className="text-stone-400 mt-5 text-lg max-w-xl mx-auto leading-relaxed">
            Trackam gives your logistics operation cryptographic proof of every custody transfer.
            Know exactly who has your goods, when they got them, and if they're ghosting you.
          </p>
          <div className="mt-10">
            <InstallBlock />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <a href="/auth/signup" className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-6 h-11 text-sm font-semibold transition-colors">
              Or sign up on this instance <ArrowRight className="h-4 w-4" />
            </a>
            <a href="https://github.com/Jeffreyon/trackam" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 text-white/80 hover:text-white hover:border-white/30 px-6 h-11 text-sm font-medium transition-colors">
              <Github className="h-4 w-4" /> View source
            </a>
          </div>
        </div>
      </section>

      {/* ── Problem ───────────────────────────────────────────────────── */}
      <section className="py-20 px-5">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-3">The problem</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 leading-tight">
            Your riders pick up goods.<br />
            Then silence.
          </h2>
          <p className="text-stone-500 mt-4 text-base max-w-xl leading-relaxed">
            No proof of pickup. No proof of delivery. When goods go missing, it's your word against theirs.
            You eat the loss, or spend days chasing riders who've gone dark.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
            <ProblemCard
              icon={<Ghost className="h-5 w-5 text-orange-600" />}
              stat="1 in 8"
              label="shipments ghosted"
              description="Riders go silent after pickup. No update for hours. You don't know if goods are delivered or stolen."
            />
            <ProblemCard
              icon={<Wallet className="h-5 w-5 text-red-500" />}
              stat="Millions"
              label="lost per year"
              description="Lost goods, unrecovered logistics costs, disputed deliveries. It compounds every month."
            />
            <ProblemCard
              icon={<Clock className="h-5 w-5 text-stone-500" />}
              stat="Hours"
              label="spent chasing updates"
              description="Calling riders, checking WhatsApp. Manual tracking that doesn't scale past 10 shipments."
            />
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section className="py-20 px-5 bg-white border-y border-border">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 leading-tight">
            Running in 10 minutes.<br />
            Dispatching in 15.
          </h2>
          <div className="mt-10 space-y-0">
            <Step number={1} title="Install Trackam" description="Open your terminal. Paste the install command. It sets up everything — database, backend, frontend. Zero config." />
            <Step number={2} title="Sign up" description="Create your account in the browser. Your OLI Switch operator registration is submitted automatically." />
            <Step number={3} title="Get your API key" description="Once approved, you'll receive an API key by email. Paste it in Settings. That's it." />
            <Step number={4} title="Start dispatching" description="Claim waybills, assign riders, group into runs, dispatch with cryptographic proof of handover at every custody transfer." />
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section className="py-20 px-5">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-3">What you get</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 leading-tight mb-10">
            Everything an ops manager needs.<br />
            Nothing they don't.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={<Shield className="h-5 w-5 text-purple-600" />}
              color="purple"
              title="Proof of Handover"
              description="SHA-256 hash at every custody transfer. Government ID captured. Immutable receipt for disputes."
            />
            <FeatureCard
              icon={<FileText className="h-5 w-5 text-orange-600" />}
              color="orange"
              title="Digital Waybills"
              description="QR-coded waybills generated in seconds. Track any package by scanning or entering the waybill number."
            />
            <FeatureCard
              icon={<Truck className="h-5 w-5 text-blue-600" />}
              color="blue"
              title="Dispatch Runs"
              description="Group shipments into runs. Assign riders. Dispatch batches with one click. Track the full trip."
            />
            <FeatureCard
              icon={<Ghost className="h-5 w-5 text-orange-500" />}
              color="orange"
              title="Ghost Detection"
              description="Automatic alerts when riders go silent. Configurable threshold. See ghost rate per rider over time."
            />
            <FeatureCard
              icon={<Users className="h-5 w-5 text-green-600" />}
              color="green"
              title="Rider Management"
              description="Track performance per rider — delivery rate, ghost rate, total shipments. Know who to trust."
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5 text-stone-600" />}
              color="stone"
              title="Cost Tracking"
              description="Fuel cost per trip. Total logistics spend. Value at risk. Monthly loss reporting."
            />
          </div>
        </div>
      </section>

      {/* ── Trust / Open Source ────────────────────────────────────────── */}
      <section className="py-20 px-5 bg-[#0a1628] text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
            Open source. Self-hosted.<br />
            <span className="text-orange-500">Your data stays yours.</span>
          </h2>
          <p className="text-stone-400 mt-4 text-base max-w-xl mx-auto leading-relaxed">
            Trackam runs on your machine. Your shipment data never touches our servers.
            The code is open — audit it, fork it, extend it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 text-left">
            <TrustCard icon={<Lock className="h-5 w-5" />} title="Self-hosted" description="Your database, your machine. No vendor lock-in. Export everything." />
            <TrustCard icon={<Globe className="h-5 w-5" />} title="GS1 EPCIS standard" description="Built on international supply chain standards. Interoperable by design." />
            <TrustCard icon={<Github className="h-5 w-5" />} title="MIT licensed" description="Free to use, modify, and distribute. Read every line of code on GitHub." />
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="py-20 px-5 bg-white border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 leading-tight">
            Ready to stop guessing where your goods are?
          </h2>
          <p className="text-stone-500 mt-3 text-base">
            Open your terminal. One command. You'll be dispatching in 15 minutes.
          </p>
          <div className="mt-8">
            <InstallBlock />
          </div>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-stone-500">
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-500" /> Free forever</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-500" /> No credit card</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-500" /> Setup in 2 minutes</span>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-stone-50 px-5 py-8">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-orange-500 flex items-center justify-center">
              <Package className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-stone-900">Trackam</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-stone-400">
            <a href="/waybill" className="hover:text-stone-700 transition-colors">Generate Waybill</a>
            <a href="https://github.com/Jeffreyon/trackam" target="_blank" rel="noopener noreferrer" className="hover:text-stone-700 transition-colors">GitHub</a>
            <span>Powered by OLI</span>
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
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div>
          <span className="text-xl font-bold text-stone-900">{stat}</span>
          <span className="text-xs text-stone-500 ml-1.5">{label}</span>
        </div>
      </div>
      <p className="text-xs text-stone-500 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: {
  number: number; title: string; description: string;
}) {
  return (
    <div className="flex gap-4 pb-8 relative">
      {/* Vertical line */}
      {number < 4 && (
        <div className="absolute left-[15px] top-[36px] bottom-0 w-px bg-orange-200" />
      )}
      <div className="h-8 w-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold shrink-0 relative z-10">
        {number}
      </div>
      <div className="pt-0.5">
        <p className="text-sm font-semibold text-stone-900">{title}</p>
        <p className="text-sm text-stone-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, color, title, description }: {
  icon: React.ReactNode; color: string; title: string; description: string;
}) {
  const bgMap: Record<string, string> = {
    purple: "bg-purple-100", orange: "bg-orange-100", blue: "bg-blue-100",
    green: "bg-green-100", stone: "bg-stone-100",
  };
  return (
    <div className="rounded-xl border border-border bg-white p-5 hover:shadow-md transition-shadow">
      <div className={`h-9 w-9 rounded-lg ${bgMap[color] || "bg-stone-100"} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-sm font-semibold text-stone-900">{title}</p>
      <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">{description}</p>
    </div>
  );
}

function TrustCard({ icon, title, description }: {
  icon: React.ReactNode; title: string; description: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="text-orange-400 mb-3">{icon}</div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">{description}</p>
    </div>
  );
}
