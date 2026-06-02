import { apiClient } from "@/lib/apiClient";
import type { UserProfile } from "./dashboard.api";

export type AdminUser = UserProfile & {
  photoURL?: string | null;
};

export type RoleItem = {
  id: string;
  description?: string;
  permissions: string[];
};

export type EventItem = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt?: number;
};

export async function fetchAllUsers(): Promise<AdminUser[]> {
  const { data } = await apiClient.get("/api/users", {
    withCredentials: true,
  });
  return data as AdminUser[];
}

export async function fetchRoles(): Promise<RoleItem[]> {
  const { data } = await apiClient.get("/api/roles", {
    withCredentials: true,
  });
  return data as RoleItem[];
}

export async function fetchEvents(type?: string): Promise<EventItem[]> {
  const { data } = await apiClient.get("/api/events", {
    withCredentials: true,
    params: type ? { type } : undefined,
  });
  return data as EventItem[];
}

// ── User management ──────────────────────────────────────────────────────

export async function updateUserRoles(userId: string, roles: string[]): Promise<AdminUser> {
  const { data } = await apiClient.patch(`/api/users/${userId}/roles`, { roles });
  return data as AdminUser;
}

export async function toggleUserDisabled(userId: string, disabled: boolean): Promise<AdminUser> {
  const { data } = await apiClient.patch(`/api/users/${userId}/disable`, { disabled });
  return data as AdminUser;
}

// ── Org settings ─────────────────────────────────────────────────────────

export type OrgSettings = {
  fuel_price_per_litre: string;
  fuel_efficiency_multiplier: string;
  ghost_threshold_hours: string;
  business_name: string;
  business_city: string;
  country: string;
};

export const orgSettingsApi = {
  get: () => apiClient.get<OrgSettings>("/api/org/settings").then((r) => r.data),
  update: (data: Partial<OrgSettings>) =>
    apiClient.patch<OrgSettings>("/api/org/settings", data).then((r) => r.data),
};

// ── Org OLI account ──────────────────────────────────────────────────────

export type OrgOliStatus = {
  status: string;
  hasApiKey: boolean;
  operatorId?: string | null;
};

export const orgOliApi = {
  get: () => apiClient.get<OrgOliStatus>("/api/oli-account/org").then((r) => r.data),
  saveApiKey: (apiKey: string) =>
    apiClient.post<OrgOliStatus>("/api/oli-account/org/api-key", { apiKey }).then((r) => r.data),
  rotateApiKey: () =>
    apiClient.post<OrgOliStatus>("/api/oli-account/org/api-key/rotate").then((r) => r.data),
};

