/**
 * Auth token management — Bearer-primary architecture.
 *
 * The session token (7-day JWT) is stored in localStorage and sent as
 * a Bearer header on every request. This is the PRIMARY auth mechanism
 * and works in all environments (same-domain, cross-domain, SSE).
 *
 * The backend also sets an HTTP-only session cookie as a fallback for
 * same-domain deployments, but the frontend never depends on it.
 *
 * The token is ONLY cleared on explicit logout. Never on navigation,
 * never on non-auth 401s, never "just in case".
 */

const TOKEN_KEY = "trackam_session_token";

export function setAuthToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore storage errors (e.g. SSR or disabled storage)
  }
}

export function getAuthToken(): string | null {
  try {
    // Migrate from old key if present
    const legacy = localStorage.getItem("auth_id_token");
    if (legacy) {
      localStorage.setItem(TOKEN_KEY, legacy);
      localStorage.removeItem("auth_id_token");
      return legacy;
    }
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("auth_id_token"); // clean up legacy key
  } catch {
    // Ignore
  }
}
