/**
 * Auth client — thin wrapper around /api/auth endpoints.
 *
 * Uses apiClient which sends the Bearer token automatically.
 * clearAuthToken is only called on explicit logout.
 */
import { clearAuthToken } from "@/lib/authToken";
import { apiClient } from "@/lib/apiClient";

export type AuthResult = {
  authenticated: boolean;
  user: unknown | null;
  profile: unknown | null;
  isAdmin: boolean;
};

function isAuthPayload(
  value: unknown
): value is {
  uid?: string;
  user?: unknown;
  profile?: unknown;
  isAdmin?: boolean;
} {
  return (
    value !== null &&
    typeof value === "object" &&
    ("user" in value || "uid" in value)
  );
}

export const authClient = {
  async getCurrentUser(): Promise<AuthResult> {
    try {
      const res = await apiClient.get("/api/auth/me");

      if (!isAuthPayload(res.data)) {
        throw new Error("Invalid auth payload");
      }

      const user = res.data.user ?? null;
      const profile = res.data.profile ?? user;
      const authenticated =
        user !== null || typeof res.data.uid === "string";

      return {
        authenticated,
        user,
        profile,
        isAdmin: res.data.isAdmin === true,
      };
    } catch {
      return {
        authenticated: false,
        user: null,
        profile: null,
        isAdmin: false,
      };
    }
  },

  async checkIsAdmin(): Promise<boolean> {
    const result = await authClient.getCurrentUser();
    return result.isAdmin;
  },

  /** Explicit logout — the ONLY place that clears the Bearer token. */
  async logout(): Promise<void> {
    try {
      await apiClient.post("/api/auth/logout");
    } catch {
      // best-effort
    } finally {
      clearAuthToken();
    }
  },
};
