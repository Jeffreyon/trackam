/**
 * Axios API client — Bearer-primary auth.
 *
 * Every request includes:
 *   1. Authorization: Bearer <token>  (from localStorage — primary)
 *   2. withCredentials: true          (sends cookie — fallback for same-domain)
 *
 * The 401 interceptor only acts on auth endpoint failures (/api/auth/).
 * Proxied OLI endpoints (/api/wallet, /api/waybill, etc.) may return
 * 401 for their own reasons and must NOT affect the user's session.
 */
import axios from "axios";
import { clearAuthToken, getAuthToken } from "@/lib/authToken";
import { assertApiBaseUrl, getApiBaseUrl } from "@/lib/runtimeConfig";

export const apiClient = axios.create({
  withCredentials: true,
});

// ── Request: attach Bearer token ────────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  config.baseURL = assertApiBaseUrl(config.baseURL ?? getApiBaseUrl());

  const token = getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: handle auth-endpoint 401s only ────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const url = error.config?.url || "";
      const isAuthEndpoint = url.includes("/api/auth/");

      if (isAuthEndpoint) {
        clearAuthToken();
        if (typeof window !== "undefined") {
          const path = window.location.pathname;
          const PUBLIC = ["/auth", "/scan", "/waybill", "/track", "/handover"];
          const isPublic = path === "/" || PUBLIC.some((p) => path.startsWith(p));
          if (!isPublic) {
            window.location.href = "/auth/login";
          }
        }
      }
    }
    return Promise.reject(error);
  }
);
