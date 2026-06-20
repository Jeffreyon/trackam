import { apiClient } from "@/lib/apiClient";

export type CapacityType = "motorcycle" | "van" | "truck" | "fleet";
export type PricingModel = "per_shipment" | "per_km" | "quoted";

export type ServiceArea = {
  city: string;
  state: string;
  country: string;
};

export type ReviewStatus = "draft" | "pending" | "approved" | "rejected";

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
  logoUrl: string | null;
  isPublished: boolean;
  reviewStatus: ReviewStatus;
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
  logoUrl?: string;
};

// ── Rate check ───────────────────────────────────────────────────────────────

export type NetworkRate = {
  carrier: string;               // 'dhl_express' | 'trackam'
  carrierId?: string;            // Trackam: operator ID
  carrierName?: string;          // Trackam: operator name
  serviceCode: string;
  serviceName: string;
  totalCharge: { amount: number; currency: string };
  transitDays: number | null;
  deliveryBy: string | null;
  // Trackam-only extras
  pricingModel?: PricingModel;
  capacityType?: CapacityType;
  specializations?: string[];
  logoUrl?: string | null;
  country?: string | null;
};

// ── Network bookings ─────────────────────────────────────────────────────────

export type NetworkBookingStatus = "pending" | "accepted" | "rejected" | "expired";

export type NetworkBooking = {
  id: string;
  waybillId: string;
  bookerOperatorId: string;
  carrierType: string;
  carrierOperatorId: string | null;
  carrierBookingId: string | null;
  quotedRateKobo: number;
  bookingFeeKobo: number;
  escrowAmountKobo: number;
  status: NetworkBookingStatus;
  notes: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  // joined fields
  waybillNumber?: string;
  pickupLocation?: string;
  deliveryLocation?: string;
  goodsDescription?: string;
  carrierName?: string | null;
  bookerName?: string | null;
};

export const networkRateApi = {
  check: (params: {
    origin: { countryCode: string; cityName: string; postalCode?: string };
    destination: { countryCode: string; cityName: string; postalCode?: string };
    packages: Array<{ weight: { value: number; unit: string }; dimensions?: { length: number; width: number; height: number; unit: string } }>;
    currency?: string;
    shipDate?: string;
  }): Promise<NetworkRate[]> =>
    apiClient.post<{ rates: NetworkRate[] }>("/api/carriers/rates", params).then((r) => r.data.rates),
};

export const networkBookingApi = {
  // Booker: create a booking
  book: (data: {
    carrier: string;
    // Trackam
    carrierId?: string;
    waybillId?: string;
    quotedRateKobo?: number;
    // Integrated
    serviceCode?: string;
    shipper?: Record<string, unknown>;
    recipient?: Record<string, unknown>;
    packages?: unknown[];
    rateSnapshot?: NetworkRate;
  }): Promise<NetworkBooking> =>
    apiClient.post<NetworkBooking>("/api/carriers/bookings", data).then((r) => r.data),

  // Booker: list own bookings
  listMine: (params?: { limit?: number; offset?: number }): Promise<NetworkBooking[]> =>
    apiClient
      .get<{ bookings: NetworkBooking[] }>("/api/carriers/network-bookings", { params })
      .then((r) => r.data.bookings),

  // Carrier: list incoming bookings
  listIncoming: (params?: { status?: NetworkBookingStatus; limit?: number; offset?: number }): Promise<NetworkBooking[]> =>
    apiClient
      .get<{ bookings: NetworkBooking[] }>("/api/carriers/incoming-bookings", { params })
      .then((r) => r.data.bookings),

  // Carrier: accept
  accept: (bookingId: string): Promise<NetworkBooking> =>
    apiClient.patch<NetworkBooking>(`/api/carriers/network-bookings/${bookingId}/accept`).then((r) => r.data),

  // Carrier: reject
  reject: (bookingId: string, notes?: string): Promise<NetworkBooking> =>
    apiClient
      .patch<NetworkBooking>(`/api/carriers/network-bookings/${bookingId}/reject`, { notes })
      .then((r) => r.data),
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

  submitForReview: (): Promise<CarrierProfile> =>
    apiClient
      .patch<CarrierProfile>("/api/operators/me/carrier-profile/publish", {})
      .then((r) => r.data),

  getDirectory: (): Promise<CarrierDirectoryEntry[]> =>
    apiClient
      .get<CarrierDirectoryEntry[]>("/api/operators/directory")
      .then((r) => r.data),
};
