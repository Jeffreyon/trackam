import { apiClient } from "@/lib/apiClient";

export type OliAccountStatus = "not_provisioned" | "pending" | "active";

export interface OliAccount {
  status: OliAccountStatus;
  hasApiKey?: boolean;
}

export const oliAccountApi = {
  get: (): Promise<OliAccount> =>
    apiClient.get<OliAccount>("/api/oli-account").then((r) => r.data),

  saveApiKey: (apiKey: string): Promise<OliAccount> =>
    apiClient.post<OliAccount>("/api/oli-account/api-key", { apiKey }).then((r) => r.data),

  rotateApiKey: (): Promise<OliAccount> =>
    apiClient.post<OliAccount>("/api/oli-account/api-key/rotate").then((r) => r.data),
};
