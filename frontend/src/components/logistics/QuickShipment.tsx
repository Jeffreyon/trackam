import { useState } from "react";
import {
  PackagePlus, X, FileText, ScanLine, Truck, ChevronRight, Clock,
} from "lucide-react";
import ClaimWaybillModal from "./ClaimWaybillModal";
import JoinLegModal from "./JoinLegModal";

interface Props {
  onDone?: () => void;
}

type ModalState = "closed" | "picker" | "claim" | "join";

export function QuickShipment({ onDone }: Props) {
  const [modal, setModal] = useState<ModalState>("closed");

  function open() { setModal("picker"); }
  function close() { setModal("closed"); onDone?.(); }

  return (
    <>
      {/* FAB */}
      <button
        onClick={open}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-orange-500 to-orange-600 px-4 h-11 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] transition-all"
      >
        <PackagePlus className="h-4 w-4" />
        Quick Shipment
      </button>

      {/* Picker modal */}
      {modal === "picker" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-sm rounded-xl bg-[#0c1522] shadow-2xl shadow-black/40 border border-white/[0.08] overflow-hidden">

            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <PackagePlus className="h-4 w-4 text-orange-400" />
                </div>
                <p className="text-sm font-semibold text-white">Add a shipment</p>
              </div>
              <button onClick={close} className="text-stone-600 hover:text-stone-300 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Card 1 — Claim waybill */}
              <button
                onClick={() => setModal("claim")}
                className="w-full flex items-center gap-4 rounded-xl border border-orange-500/25 bg-orange-500/[0.07] hover:bg-orange-500/[0.12] hover:border-orange-500/40 p-4 text-left transition-all group"
              >
                <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-orange-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">Claim a waybill</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Scan the QR or enter the waybill number and claim code.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-stone-600 group-hover:text-orange-400 transition-colors shrink-0" />
              </button>

              {/* Card 2 — Join a leg */}
              <button
                onClick={() => setModal("join")}
                className="w-full flex items-center gap-4 rounded-xl border border-purple-500/25 bg-purple-500/[0.07] hover:bg-purple-500/[0.12] hover:border-purple-500/40 p-4 text-left transition-all group"
              >
                <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                  <ScanLine className="h-5 w-5 text-purple-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">Join a leg</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Take custody of a shipment arriving from a courier or partner operator.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-stone-600 group-hover:text-purple-400 transition-colors shrink-0" />
              </button>

              {/* Card 3 — Dispatch to courier (coming soon) */}
              <div className="w-full flex items-center gap-4 rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 cursor-not-allowed opacity-60">
                <div className="h-10 w-10 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                  <Truck className="h-5 w-5 text-stone-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-stone-400">Dispatch to courier</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-800 border border-white/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-stone-500">
                      <Clock className="h-2.5 w-2.5" /> Coming soon
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    GIG Logistics · Fez Delivery · FedEx · DHL and more.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Claim waybill modal */}
      {modal === "claim" && (
        <ClaimWaybillModal
          onClose={close}
          onClaimed={() => onDone?.()}
        />
      )}

      {/* Join leg modal */}
      {modal === "join" && (
        <JoinLegModal
          onClose={close}
          onJoined={() => onDone?.()}
        />
      )}
    </>
  );
}
