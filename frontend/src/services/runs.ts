import { apiClient } from "@/lib/apiClient";

// ── Types ──────────────────────────────────────────────────────────────────

export type RunStatus = "loading" | "in_transit" | "completed" | "cancelled";

export interface RunLeg {
  id: string;
  shipmentId: string;
  waybillId: string | null;
  waybillNumber: string | null;
  goodsDescription: string;
  pickupLocation: string;
  deliveryLocation: string;
  status: string;
  recipientName: string | null;
  recipientPhone: string | null;
  shipmentValue: number;
  handoverCount: number;
  addedAt: string;
}

export interface DispatchRun {
  id: string;
  userId: string;
  name: string | null;
  riderId: string | null;
  riderName: string | null;
  status: RunStatus;
  notes: string | null;
  distanceKm: number;
  riderFee: number;       // kobo
  fuelCost: number;       // kobo
  totalCost: number;      // kobo
  expectedDeliveryDate: string | null;
  delayFlag: boolean;
  ghostingFlag: boolean;
  departedAt: string | null;
  completedAt: string | null;
  legCount: number;
  totalValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface DispatchRunDetail extends DispatchRun {
  legs: RunLeg[];
}

// ── API ────────────────────────────────────────────────────────────────────

export const runsApi = {
  list: () =>
    apiClient.get<DispatchRun[]>("/api/runs").then((r) => r.data),

  get: (id: string) =>
    apiClient.get<DispatchRunDetail>(`/api/runs/${id}`).then((r) => r.data),

  create: (data: {
    name?: string;
    riderId?: string;
    notes?: string;
    distanceKm?: number;
    riderFee?: number;          // NGN (not kobo) — backend converts
    expectedDeliveryDate?: string;
  }) =>
    apiClient.post<DispatchRun>("/api/runs", data).then((r) => r.data),

  update: (id: string, data: {
    name?: string;
    riderId?: string;
    notes?: string;
    distanceKm?: number;
    riderFee?: number;
    expectedDeliveryDate?: string;
  }) =>
    apiClient.patch<DispatchRun>(`/api/runs/${id}`, data).then((r) => r.data),

  updateStatus: (id: string, status: RunStatus) =>
    apiClient.patch<DispatchRun>(`/api/runs/${id}/status`, { status }).then((r) => r.data),

  addLeg: (id: string, shipmentId: string) =>
    apiClient.post<DispatchRunDetail>(`/api/runs/${id}/legs`, { shipmentId }).then((r) => r.data),

  removeLeg: (id: string, shipmentId: string) =>
    apiClient.delete<DispatchRunDetail>(`/api/runs/${id}/legs/${shipmentId}`).then((r) => r.data),
};
