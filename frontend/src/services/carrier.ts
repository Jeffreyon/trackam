import { apiClient } from "@/lib/apiClient";

export type CapacityType = "motorcycle" | "van" | "truck" | "fleet";
export type PricingModel = "per_shipment" | "per_km" | "quoted";

export type ServiceArea = {
  city: string;
  state: string;
  country: string;
};

export type CarrierProfile = {
  operatorId: string;
  capacityType: CapacityType;
  serviceAreas: ServiceArea[];
  pricingModel: PricingModel;
  baseRate: number;
  currency: string;
  bio: string | null;
  fleetSize: number | null;
  specializations: string[];
  isPublished: boolean;
  updatedAt: string;
};

export type CarrierDirectoryEntry = CarrierProfile & {
  name: string;
  country: string;
  frontendUrl: string | null;
};

export type CarrierProfileInput = {
  capacityType: CapacityType;
  serviceAreas: ServiceArea[];
  pricingModel: PricingModel;
  baseRate: number;
  currency: string;
  bio?: string;
  fleetSize?: number;
  specializations?: string[];
};

export const carrierApi = {
  getProfile: (): Promise<CarrierProfile | null> =>
    apiClient
      .get<CarrierProfile>("/api/operators/me/carrier-profile")
      .then((r) => (r.data && r.data.operatorId ? r.data : null))
      .catch(() => null),

  saveProfile: (data: CarrierProfileInput): Promise<CarrierProfile> =>
    apiClient
      .put<CarrierProfile>("/api/operators/me/carrier-profile", data)
      .then((r) => r.data),

  setPublished: (published: boolean): Promise<CarrierProfile> =>
    apiClient
      .patch<CarrierProfile>("/api/operators/me/carrier-profile/publish", { published })
      .then((r) => r.data),

  getDirectory: (): Promise<CarrierDirectoryEntry[]> =>
    apiClient
      .get<CarrierDirectoryEntry[]>("/api/operators/directory")
      .then((r) => r.data),
};
