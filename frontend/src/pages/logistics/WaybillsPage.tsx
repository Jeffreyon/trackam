import { useEffect, useState } from "react";
import {
  FileText, CheckCircle2, Clock, ExternalLink, Search,
  ShieldCheck, Plus, ChevronDown, ChevronUp, Truck, AlertCircle,
} from "lucide-react";
import { waybillApi, type OperatorWaybill } from "@/services/handover";
import AssignRunModal from "@/components/logistics/AssignRunModal";

type Filter = "all" | "in_transit" | "delivered";
type ActionMode = "claim" | "join" | null;

interface PendingAssign {
  shipmentId: string;
  waybillNumber: string;
}

export default function WaybillsPage() {
  const [waybills, setWaybills] = useState<OperatorWaybill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [pendingAssign, setPendingAssign] = useState<PendingAssign | null>(null);

  const [claimNumber, setClaimNumber] = useState("");
  const [claimToken, setClaimToken] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claimWorking, setClaimWorking] = useState(false);

  const [joinWaybillId, setJoinWaybillId] = useState("");
  const [joinProofHash, setJoinProofHash] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinWorking, setJoinWorking] = useState(false);

  async function reload() {
    const data = await waybillApi.list();
    setWaybills(data);
  }

  useEffect(() => { reload().finally(() => setLoading(false)); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinParam = params.get("join");
    const pohParam = params.get("poh");
    if (joinParam) {
      setActionMode("join");
      setJoinWaybillId(joinParam);
      if (pohParam) setJoinProofHash(pohParam);
    }
  }, []);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setClaimError("");
    setClaimWorking(true);
    try {
      const result = await waybillApi.claim({
        waybillNumber: claimNumber.trim().toUpperCase(),
        claimToken: claimToken.trim().toUpperCase(),
      });
      setClaimNumber(""); setClaimToken(""); setActionMode(null);
      const fresh = await waybillApi.list();
      setWaybills(fresh);
      const wb = fresh.find((w) => w.shipmentId === result.shipmentId);
      setPendingAssign({ shipmentId: result.shipmentId, waybillNumber: wb?.waybillNumber ?? claimNumber });
    } catch (e: unknown) {
      setClaimError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to claim waybill.");
    } finally { setClaimWorking(false); }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError("");
    setJoinWorking(true);
    try {
      const result = await waybillApi.joinLeg(joinWaybillId.trim(), joinProofHash.trim());
      setJoinWaybillId(""); setJoinProofHash(""); setActionMode(null);
      const fresh = await waybillApi.list();
      setWaybills(fresh);
      const wb = fresh.find((w) => w.shipmentId === result.shipmentId);
      setPendingAssign({ shipmentId: result.shipmentId, waybillNumber: wb?.waybillNumber ?? joinWaybillId });
    } catch (e: unknown) {
      setJoinError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to join leg.");
    } finally { setJoinWorking(false); }
  }

  const filtered = waybills.filter((w) => {
    if (filter === "delivered" && !w.isDelivered) return false;
    if (filter === "in_transit" && w.isDelivered) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        w.waybillNumber.toLowerCase().includes(q) ||
        w.goodsDescription.toLowerCase().includes(q) ||
        w.senderName.toLowerCase().includes(q) ||
        w.receiverName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: waybills.length,
    in_transit: waybills.filter((w) => !w.isDelivered).length,
    delivered: waybills.filter((w) => w.isDelivered).length,
  };

  const inputCls = "w-full rounded-md border border-input bg-white px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActionMode(actionMode === "claim" ? null : "claim")}
            className={["inline-flex items-center gap-1.5 rounded-md px-3 h-9 text-xs font-medium transition-colors",
              actionMode === "claim" ? "bg-orange-600 text-white" : "bg-white border border-border text-foreground hover:bg-secondary"].join(" ")}
          >
            <Plus className="h-3.5 w-3.5" /> Claim waybill
            {actionMode === "claim" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <button
            onClick={() => setActionMode(actionMode === "join" ? null : "join")}
            className={["inline-flex items-center gap-1.5 rounded-md px-3 h-9 text-xs font-medium transition-colors",
              actionMode === "join" ? "bg-purple-600 text-white" : "bg-white border border-border text-foreground hover:bg-secondary"].join(" ")}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Join leg
            {actionMode === "join" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto sm:items-center">
          <div className="flex gap-1 rounded-lg border border-border bg-secondary/40 p-1">
            {(["all", "in_transit", "delivered"] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={["rounded-md px-3 h-7 text-xs font-medium transition-colors",
                  filter === f ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}>
                {f === "all" ? "All" : f === "in_transit" ? "In transit" : "Delivered"}
                <span className="ml-1.5 text-[10px] text-muted-foreground">{counts[f]}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search waybills..."
              className="w-full sm:w-52 rounded-md border border-input bg-white pl-8 pr-3 h-9 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
      </div>

      {actionMode === "claim" && (
        <form onSubmit={handleClaim} className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-orange-900">Claim a waybill from the OLI network</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-foreground block mb-1">Waybill number</label>
              <input required value={claimNumber} onChange={(e) => setClaimNumber(e.target.value.toUpperCase())}
                placeholder="WB-20260508-XXXXXX" className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-foreground block mb-1">Claim token (from sender)</label>
              <input required value={claimToken} onChange={(e) => setClaimToken(e.target.value.toUpperCase())}
                placeholder="8-character code" className={`${inputCls} tracking-widest font-mono`} />
            </div>
          </div>
          {claimError && <p className="flex items-center gap-1.5 text-xs text-red-700"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{claimError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={claimWorking}
              className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 text-white px-4 h-9 text-xs font-semibold hover:bg-orange-700 transition-colors disabled:opacity-60">
              {claimWorking ? "Claiming..." : "Claim waybill"}
            </button>
            <button type="button" onClick={() => setActionMode(null)} className="text-xs text-muted-foreground hover:text-foreground px-2">Cancel</button>
          </div>
        </form>
      )}

      {actionMode === "join" && (
        <form onSubmit={handleJoin} className="rounded-lg border border-purple-200 bg-purple-50 p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-purple-900">Join an existing waybill leg</p>
            <p className="text-[11px] text-purple-700 mt-0.5">Enter the Proof-of-Handover hash received from the previous custodian.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-foreground block mb-1">Waybill ID</label>
              <input required value={joinWaybillId} onChange={(e) => setJoinWaybillId(e.target.value.trim())}
                placeholder="Waybill UUID" className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-foreground block mb-1">Proof-of-Handover hash</label>
              <input required value={joinProofHash} onChange={(e) => setJoinProofHash(e.target.value.trim())}
                placeholder="64-char hex hash" className={`${inputCls} font-mono text-xs`} />
            </div>
          </div>
          {joinError && <p className="flex items-center gap-1.5 text-xs text-red-700"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{joinError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={joinWorking}
              className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 text-white px-4 h-9 text-xs font-semibold hover:bg-purple-700 transition-colors disabled:opacity-60">
              {joinWorking ? "Joining..." : "Join leg"}
            </button>
            <button type="button" onClick={() => setActionMode(null)} className="text-xs text-muted-foreground hover:text-foreground px-2">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-secondary/50 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white py-16 text-center space-y-2">
          <div className="flex justify-center"><div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center"><FileText className="h-5 w-5 text-muted-foreground" /></div></div>
          <p className="text-sm font-medium text-foreground">{waybills.length === 0 ? "No waybills yet" : "No results"}</p>
          <p className="text-xs text-muted-foreground">{waybills.length === 0 ? "Use Claim waybill to register an OLI waybill, or Join leg if you received a PoH hash." : "Try a different search or filter."}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_1.4fr_1fr_7rem_4rem_7rem] gap-4 px-4 py-2.5 border-b border-border bg-secondary/30">
            {["Waybill", "Route", "Cargo", "Run", "Handovers", "Status"].map((h) => (
              <p key={h} className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{h}</p>
            ))}
          </div>
          <div className="divide-y divide-border">
            {filtered.map((w) => (
              <div key={w.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_1fr_7rem_4rem_7rem] gap-2 sm:gap-4 items-center px-4 py-3.5 hover:bg-secondary/20 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-mono font-semibold text-foreground truncate">{w.waybillNumber}</p>
                    <a href={`/track/${w.id}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors shrink-0"><ExternalLink className="h-3 w-3" /></a>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(w.claimedAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-foreground truncate">{w.senderName} to {w.receiverName}</p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{w.pickupLocation} to {w.deliveryLocation}</p>
                </div>
                <p className="text-xs text-foreground truncate">{w.goodsDescription}</p>
                <div className="shrink-0">
                  {w.runId ? (
                    <a href={`/dashboard/runs/${w.runId}`} className="inline-flex items-center gap-1 rounded-full bg-stone-100 border border-stone-200 text-stone-700 px-2 py-0.5 text-[11px] font-medium hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 transition-colors whitespace-nowrap">
                      <Truck className="h-2.5 w-2.5" />{w.runName ? (w.runName.length > 14 ? w.runName.slice(0, 14) + "..." : w.runName) : "Run"}
                    </a>
                  ) : w.shipmentId ? (
                    <button onClick={() => setPendingAssign({ shipmentId: w.shipmentId!, waybillNumber: w.waybillNumber })}
                      className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5 text-[11px] font-medium hover:bg-orange-100 transition-colors whitespace-nowrap">
                      <Plus className="h-2.5 w-2.5" /> Assign run
                    </button>
                  ) : <span className="text-[11px] text-muted-foreground">No run</span>}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0"><ShieldCheck className="h-3.5 w-3.5 shrink-0" /><span>{w.handoverCount}</span></div>
                <div className="shrink-0">
                  {w.isDelivered ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"><CheckCircle2 className="h-3 w-3" /> Delivered</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"><Clock className="h-3 w-3" /> In transit</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingAssign && (
        <AssignRunModal shipmentId={pendingAssign.shipmentId} waybillNumber={pendingAssign.waybillNumber} onClose={() => setPendingAssign(null)} />
      )}
    </div>
  );
}
