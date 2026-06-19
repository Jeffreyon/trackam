import { apiClient } from "@/lib/apiClient";

export type UserProfile = {
  id: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  roles?: string[];
  capabilities?: string[];
  preferences?: {
    locale?: string;
    theme?: string;
  };
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
};

export type DeviceItem = {
  id: string;
  deviceId: string;
  lastSeen?: number;
  isCurrent?: boolean;
};

export type SessionItem = {
  id: string;
  createdAt?: number;
  ip?: string;
  endedAt?: number | null;
  userAgent?: string | null;
};

export type GlobalSettings = {
  id: string;
  supportEmail?: string;
  allowedRegions: string[];
};

export type AuthMeResponse = {
  uid: string;
  user: UserProfile | null;
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
};

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const { data } = await apiClient.get("/api/auth/me", {
    withCredentials: true,
  });
  return data as AuthMeResponse;
}

export async function fetchUser(uid: string): Promise<UserProfile | null> {
  const { data } = await apiClient.get(`/api/users/${uid}`, {
    withCredentials: true,
  });
  return data as UserProfile;
}

export async function updateUser(
  uid: string,
  payload: Partial<UserProfile>
): Promise<UserProfile> {
  const { data } = await apiClient.put(`/api/users/${uid}`, payload, {
    withCredentials: true,
  });
  return data as UserProfile;
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const { data } = await apiClient.get("/api/notifications", {
    withCredentials: true,
  });
  return data as NotificationItem[];
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await apiClient.post(
    "/api/notifications/mark-read",
    { ids },
    { withCredentials: true }
  );
}

export async function fetchDevices(): Promise<DeviceItem[]> {
  const { data } = await apiClient.get("/api/devices", {
    withCredentials: true,
  });
  return data as DeviceItem[];
}

export async function fetchSessions(): Promise<SessionItem[]> {
  const { data } = await apiClient.get("/api/sessions", {
    withCredentials: true,
  });
  return data as SessionItem[];
}

export async function fetchGlobalSettings(): Promise<GlobalSettings | null> {
  const { data } = await apiClient.get("/api/settings/global", {
    withCredentials: true,
  });
  return data as GlobalSettings;
}
