import { apiClient } from "@/lib/apiClient";
import type { UserProfile } from "./dashboard.api";
import type { GovtIdType, VerificationState } from "./logistics";

export type AdminUser = UserProfile & {
  photoURL?: string | null;

  // Staff profile fields — populated on /api/users responses.
  phone?: string | null;
  phoneVerifiedAt?: string | null;
  govtIdType?: GovtIdType | null;
  govtIdNumber?: string | null;
  govtIdPhoto?: string | null;  // only present when includePhoto=1
  govtIdVerifiedAt?: string | null;
  govtIdVerifiedBy?: string | null;
  govtIdRejectionReason?: string | null;
  verificationState?: VerificationState;
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

// Staff verification queue + actions
export async function fetchStaffPendingVerification(): Promise<AdminUser[]> {
  const { data } = await apiClient.get("/api/users/pending-verification");
  return data as AdminUser[];
}

export async function fetchUserWithPhoto(userId: string): Promise<AdminUser> {
  const { data } = await apiClient.get(`/api/users/${userId}`, {
    params: { includePhoto: 1 },
  });
  return data as AdminUser;
}

export async function verifyStaff(userId: string): Promise<AdminUser> {
  const { data } = await apiClient.post(`/api/users/${userId}/verify`);
  return data as AdminUser;
}

export async function rejectStaff(userId: string, rejectionReason: string): Promise<AdminUser> {
  const { data } = await apiClient.post(`/api/users/${userId}/reject`, { rejectionReason });
  return data as AdminUser;
}

// Self / admin — update a user's staff profile (phone + ID)
export async function updateStaffProfile(
  userId: string,
  data: { phone?: string; govtIdType?: GovtIdType | null; govtIdNumber?: string | null; govtIdPhoto?: string | null }
): Promise<AdminUser> {
  const { data: out } = await apiClient.patch(`/api/users/${userId}/staff-profile`, data);
  return out as AdminUser;
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
  logo_url: string;
  contact_phone: string;
  website_url: string;
  sla_target_hours: string;
  waybill_prefix: string;
  [key: string]: string;
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

