import { apiClient } from "@/lib/apiClient";

// ── Types ──────────────────────────────────────────────────────────────────

export type VehicleType = "bike" | "tricycle" | "van" | "truck";
export type ShipmentStatus = "pending" | "in_transit" | "delivered" | "failed" | "ghosted";
export type RiskScore = "low" | "medium" | "high";

export interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicleType: VehicleType;
  cityCoverage: string;
  baseFee: number;
  isActive: boolean;
  ghostRate: number | null;
  totalShipments: number | null;
  createdAt: string;
}

export interface Route {
  id: string;
  name: string;
  pickupLocation: string;
  deliveryLocation: string;
  distanceKm: number;
  defaultRiderId: string | null;
  defaultRiderFee: number;
  defaultGoodsDescription: string | null;
  defaultRiderName: string | null;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface Shipment {
  id: string;
  routeId: string | null;
  riderId: string | null;
  riderName: string | null;
  goodsDescription: string;
  pickupLocation: string;
  deliveryLocation: string;
  distanceKm: number;
  riderFee: number;
  fuelCost: number;
  totalCost: number;
  status: ShipmentStatus;
  riskScore: RiskScore;
  riskScorePoints: number;
  riskScoreReasons: string[];
  recipientName: string | null;
  recipientPhone: string | null;
  expectedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  lastStatusUpdateAt: string;
  delayFlag: boolean;
  ghostingFlag: boolean;
  shipmentValue: number;
  notes: string | null;
  createdAt: string;
}

export interface StatusLogEntry {
  id: string;
  shipmentId: string;
  oldStatus: string | null;
  newStatus: string;
  note: string | null;
  changedAt: string;
}

export interface DashboardSummary {
  today: { pending: number; inTransit: number; delivered: number };
  month: { totalShipments: number; deliveredCount: number; ghostedCount: number; ghostRate: number; totalCostKobo: number; valueLostKobo: number };
  exposure: { valueAtRiskKobo: number; allTimeValueLostKobo: number };
  alertCount: number;
}

export interface LogisticsSettings {
  fuel_price_per_litre: string;
  fuel_efficiency_multiplier: string;
  ghost_threshold_hours: string;
  business_name: string;
  business_city: string;
}

// ── Riders ────────────────────────────────────────────────────────────────

export const ridersApi = {
  list: () => apiClient.get<Rider[]>("/api/riders").then((r) => r.data),
  get: (id: string) => apiClient.get<Rider>(`/api/riders/${id}`).then((r) => r.data),
  create: (data: Partial<Rider>) => apiClient.post<Rider>("/api/riders", data).then((r) => r.data),
  update: (id: string, data: Partial<Rider>) => apiClient.patch<Rider>(`/api/riders/${id}`, data).then((r) => r.data),
  deactivate: (id: string) => apiClient.delete(`/api/riders/${id}`),
};

// ── Routes ────────────────────────────────────────────────────────────────

export const routesApi = {
  list: () => apiClient.get<Route[]>("/api/routes").then((r) => r.data),
  get: (id: string) => apiClient.get<Route>(`/api/routes/${id}`).then((r) => r.data),
  create: (data: Partial<Route>) => apiClient.post<Route>("/api/routes", data).then((r) => r.data),
  update: (id: string, data: Partial<Route>) => apiClient.patch<Route>(`/api/routes/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/api/routes/${id}`),
};

// ── Shipments ─────────────────────────────────────────────────────────────

export const shipmentsApi = {
  list: (params?: { status?: string; riderId?: string }) =>
    apiClient.get<Shipment[]>("/api/shipments", { params }).then((r) => r.data),
  get: (id: string) => apiClient.get<Shipment>(`/api/shipments/${id}`).then((r) => r.data),
  getLog: (id: string) => apiClient.get<StatusLogEntry[]>(`/api/shipments/${id}/log`).then((r) => r.data),
  create: (data: Partial<Shipment> & { riderFee?: number; shipmentValue?: number }) =>
    apiClient.post<Shipment>("/api/shipments", data).then((r) => r.data),
  updateStatus: (id: string, status: ShipmentStatus, note?: string) =>
    apiClient.patch<Shipment>(`/api/shipments/${id}/status`, { status, note }).then((r) => r.data),
};

// ── Dashboard ─────────────────────────────────────────────────────────────

export const dashboardApi = {
  summary: () => apiClient.get<DashboardSummary>("/api/logistics/dashboard/summary").then((r) => r.data),
  alerts: () => apiClient.get<Shipment[]>("/api/logistics/dashboard/alerts").then((r) => r.data),
  costs: () => apiClient.get("/api/logistics/dashboard/costs").then((r) => r.data),
};

// ── Settings ──────────────────────────────────────────────────────────────

export const logisticsSettingsApi = {
  get: () => apiClient.get<LogisticsSettings>("/api/logistics/settings").then((r) => r.data),
  update: (data: Partial<LogisticsSettings>) =>
    apiClient.patch<LogisticsSettings>("/api/logistics/settings", data).then((r) => r.data),
};
