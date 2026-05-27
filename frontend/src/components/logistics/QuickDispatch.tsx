/**
 * QuickDispatch — FAB + modal for the Runs page.
 *
 * Flow:
 *   Step 1 — Pick a saved route (sets mental corridor, prefills default rider)
 *   Step 2 — Confirm: rider, run name, notes
 *   → Creates a dispatch run → navigates to run detail page
 *
 * Routes are not stored on the run (no FK in schema). They serve as a mental
 * template: the operator picks the corridor their rider covers today, the route
 * name becomes the default run name, and the default rider is prefilled.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, X, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { routesApi, ridersApi, type Route, type Rider } from "@/services/logistics";
import { runsApi } from "@/services/runs";

interface Props {
  onCreated?: () => void;
}

type Step = "route" | "confirm";

export function QuickDispatch({ onCreated }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("route");

  const [routes, setRoutes] = useState<Route[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [runName, setRunName] = useState("");
  const [riderId, setRiderId] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDataLoading(true);
      Promise.all([routesApi.list(), ridersApi.list()])
        .then(([r, ri]) => { setRoutes(r); setRiders(ri); })
        .finally(() => setDataLoading(false));
    }
  }, [open]);

  function openModal() {
    setStep("route");
    setSelectedRoute(null);
    setRunName("");
    setRiderId("");
    setNotes("");
    setError("");
    setOpen(true);
  }

  function selectRoute(route: Route) {
    setSelectedRoute(route);
    setRunName(route.name);
    setRiderId(route.defaultRiderId || "");
    setError("");
    setStep("confirm");
  }

  async function handleCreate() {
    setSubmitting(true);
    setError("");
    try {
      const run = await runsApi.create({
        name: runName.trim() || undefined,
        riderId: riderId || undefined,
        notes: notes.trim() || undefined,
      });
      setOpen(false);
      onCreated?.();
      navigate(`/dashboard/runs/${run.id}`);
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create run. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={openModal}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 h-11 text-sm font-semibold text-white shadow-lg hover:bg-primary/90 transition-colors"
      >
        <Zap className="h-4 w-4" />
        Quick Dispatch
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-border overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[75vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {step === "route" ? "Pick a route" : "Set up this run"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {step === "route"
                    ? "Choose the corridor your rider will cover today"
                    : selectedRoute
                      ? `${selectedRoute.pickupLocation} → ${selectedRoute.deliveryLocation}`
                      : ""}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── Step 1: Route picker ─────────────────────────────── */}
            {step === "route" && (
              <div className="p-4 overflow-y-auto flex-1">
                {dataLoading ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-secondary/50 animate-pulse" />)}
                  </div>
                ) : routes.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">No saved routes yet.</p>
                    <a href="/dashboard/routes" className="text-xs text-primary hover:underline">
                      Set up your first route →
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {routes.map((route) => (
                      <button
                        key={route.id}
                        onClick={() => selectRoute(route)}
                        className="w-full flex items-center justify-between rounded-lg border border-border bg-white p-3 text-left hover:border-primary/40 hover:bg-accent/30 transition-colors group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{route.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {route.pickupLocation} → {route.deliveryLocation} · {route.distanceKm} km
                          </p>
                          {route.defaultRiderName && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Default rider: {route.defaultRiderName}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Confirm ──────────────────────────────────── */}
            {step === "confirm" && selectedRoute && (
              <>
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                  {/* Run name */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Run name</label>
                    <input
                      value={runName}
                      onChange={(e) => setRunName(e.target.value)}
                      placeholder={`e.g. ${selectedRoute.name} — Morning`}
                      className="w-full rounded-md border border-input bg-white px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Helps you identify this run on the manifest.</p>
                  </div>

                  {/* Rider */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Rider</label>
                    <select
                      value={riderId}
                      onChange={(e) => setRiderId(e.target.value)}
                      className="w-full rounded-md border border-input bg-white px-3 h-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">No rider assigned yet</option>
                      {riders.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} · {r.vehicleType}
                          {r.ghostRate != null && r.ghostRate > 10 ? ` ⚠ ${r.ghostRate}% ghost` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Priority cargo, departs 8 AM"
                      className="w-full rounded-md border border-input bg-white px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {error && (
                    <p className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 px-5 py-3 border-t border-border bg-white shrink-0">
                  <button
                    onClick={() => setStep("route")}
                    className="flex-none rounded-md border border-border bg-white px-3 h-9 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary h-9 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
                  >
                    {submitting
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating run…</>
                      : "Create run & add waybills →"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
