import { useState, useEffect } from "react";
import { Zap, X, ChevronRight, Loader2 } from "lucide-react";
import { routesApi, ridersApi, shipmentsApi, type Route, type Rider } from "@/services/logistics";

interface Props {
  onDispatched?: () => void;
}

type Step = "route" | "confirm";

export function QuickDispatch({ onDispatched }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("route");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [riderId, setRiderId] = useState<string>("");
  const [riderFee, setRiderFee] = useState<string>("");
  const [expectedDate, setExpectedDate] = useState<string>("tomorrow");
  const [notes, setNotes] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      Promise.all([routesApi.list(), ridersApi.list()]).then(([r, ri]) => {
        setRoutes(r);
        setRiders(ri);
      });
    }
  }, [open]);

  function openModal() {
    setStep("route");
    setSelectedRoute(null);
    setRiderId("");
    setRiderFee("");
    setExpectedDate("tomorrow");
    setNotes("");
    setRecipientName("");
    setRecipientPhone("");
    setError("");
    setOpen(true);
  }

  function selectRoute(route: Route) {
    setSelectedRoute(route);
    setRiderId(route.defaultRiderId || "");
    setRiderFee(route.defaultRiderFee ? String(route.defaultRiderFee / 100) : "");
    setStep("confirm");
  }

  function resolvedDate(): string | undefined {
    if (expectedDate === "today") return new Date().toISOString().split("T")[0];
    if (expectedDate === "tomorrow") {
      const d = new Date(); d.setDate(d.getDate() + 1);
      return d.toISOString().split("T")[0];
    }
    if (expectedDate === "in2days") {
      const d = new Date(); d.setDate(d.getDate() + 2);
      return d.toISOString().split("T")[0];
    }
    return undefined;
  }

  async function handleDispatch() {
    if (!selectedRoute) return;
    setSubmitting(true);
    setError("");
    try {
      await shipmentsApi.create({
        routeId: selectedRoute.id,
        riderId: riderId || undefined,
        goodsDescription: selectedRoute.defaultGoodsDescription || "Goods",
        pickupLocation: selectedRoute.pickupLocation,
        deliveryLocation: selectedRoute.deliveryLocation,
        distanceKm: selectedRoute.distanceKm,
        riderFee: riderFee ? parseFloat(riderFee) : 0,
        expectedDeliveryDate: resolvedDate(),
        notes: notes || undefined,
        recipientName: recipientName || undefined,
        recipientPhone: recipientPhone || undefined,
      } as Parameters<typeof shipmentsApi.create>[0]);
      setOpen(false);
      onDispatched?.();
    } catch {
      setError("Failed to dispatch. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* FAB trigger */}
      <button
        onClick={openModal}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 h-11 text-sm font-semibold text-white shadow-lg hover:bg-primary/90 transition-colors"
      >
        <Zap className="h-4 w-4" />
        Quick Dispatch
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">
                  {step === "route" ? "Pick a route" : "Confirm dispatch"}
                </span>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step 1: Route picker */}
            {step === "route" && (
              <div className="p-4">
                {routes.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">No saved routes yet.</p>
                    <a href="/dashboard/routes" className="mt-1 text-xs text-primary hover:underline">
                      Set up your first route →
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {routes.map((route) => (
                      <button
                        key={route.id}
                        onClick={() => selectRoute(route)}
                        className="w-full flex items-center justify-between rounded-lg border border-border bg-white p-3 text-left hover:border-primary/40 hover:bg-accent/30 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{route.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {route.pickupLocation} → {route.deliveryLocation} · {route.distanceKm} km
                          </p>
                          {route.defaultRiderName && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Default: {route.defaultRiderName}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Confirm */}
            {step === "confirm" && selectedRoute && (
              <div className="p-4 space-y-4">
                <div className="rounded-lg bg-secondary p-3">
                  <p className="text-xs font-semibold text-foreground">{selectedRoute.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {selectedRoute.pickupLocation} → {selectedRoute.deliveryLocation} · {selectedRoute.distanceKm} km
                  </p>
                </div>

                {/* Rider select */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Rider</label>
                  <select
                    value={riderId}
                    onChange={(e) => setRiderId(e.target.value)}
                    className="w-full rounded-md border border-input bg-white px-3 h-9 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">No rider assigned</option>
                    {riders.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.vehicleType})
                        {r.ghostRate != null && r.ghostRate > 10 ? ` ⚠ ${r.ghostRate}% ghost` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rider fee */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Rider fee (₦)</label>
                  <input
                    type="number"
                    value={riderFee}
                    onChange={(e) => setRiderFee(e.target.value)}
                    placeholder="e.g. 45000"
                    className="w-full rounded-md border border-input bg-white px-3 h-9 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Expected delivery */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Expected delivery</label>
                  <div className="flex gap-2">
                    {["today", "tomorrow", "in2days"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setExpectedDate(opt)}
                        className={[
                          "flex-1 rounded-md border text-xs h-8 font-medium transition-colors",
                          expectedDate === opt
                            ? "border-primary bg-accent text-primary"
                            : "border-border bg-white text-muted-foreground hover:border-primary/40",
                        ].join(" ")}
                      >
                        {opt === "today" ? "Today" : opt === "tomorrow" ? "Tomorrow" : "In 2 days"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient */}
                <div className="rounded-md bg-secondary/60 border border-border p-3 space-y-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Recipient — helps verify delivery
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Name</label>
                      <input
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="e.g. Alhaji Bello"
                        className="w-full rounded-md border border-input bg-white px-3 h-9 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Phone</label>
                      <input
                        type="tel"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        placeholder="08012345678"
                        className="w-full rounded-md border border-input bg-white px-3 h-9 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  {recipientPhone && (
                    <p className="text-[11px] text-green-700">✓ Risk score will be reduced — recipient can confirm delivery</p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Notes (optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any extra context…"
                    className="w-full rounded-md border border-input bg-white px-3 h-9 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setStep("route")}
                    className="flex-none rounded-md border border-border bg-white px-3 h-9 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleDispatch}
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary h-9 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
                  >
                    {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Dispatching…</> : "Dispatch →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
