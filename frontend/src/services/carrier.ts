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
  distanceKm?: number | null;    // set when per_km rate was computed against a known distance
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
    distanceKm?: number | null;
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

// ── Carrier routes ────────────────────────────────────────────────────────────

export type CarrierRoute = {
  id: string;
  operatorId: string;
  label: string | null;
  originCity: string;
  destCity: string;
  distanceKm: number | null;
  fixedPriceKobo: number | null;
  isActive: boolean;
  createdAt: string;
};

export const carrierRoutesApi = {
  list: (): Promise<CarrierRoute[]> =>
    apiClient.get<{ routes: CarrierRoute[] }>("/api/carriers/routes").then((r) => r.data.routes),

  add: (data: {
    originCity: string;
    destCity: string;
    distanceKm?: number | null;
    fixedPriceKobo?: number | null;
    label?: string | null;
  }): Promise<CarrierRoute> =>
    apiClient.post<CarrierRoute>("/api/carriers/routes", data).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    apiClient.delete(`/api/carriers/routes/${id}`).then(() => undefined),
};

// ── Run bookings ─────────────────────────────────────────────────────────────

export type RunBookingStatus = "pending" | "accepted" | "rejected" | "received";

export type RunBooking = {
  id: string;
  bookerOperatorId: string;
  carrierOperatorId: string;
  originCity: string;
  destCity: string;
  distanceKm: number | null;
  quotedRateKobo: number;
  bookingFeeKobo: number;
  status: RunBookingStatus;
  notes: string | null;
  sourceRunId: string | null;
  dropoffToken: string | null;
  dropoffTokenExpiresAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  expiresAt: string | null;
  receivedAt: string | null;
  pickedUpAt: string | null;    // set when carrier's rider scanned at booker's location
  handoverMode: HandoverMode | null;  // set at acceptance; determines pickup vs drop-off path
  createdAt: string;
  updatedAt: string;
  // joined
  bookerName?: string;
  carrierName?: string;
  waybillIds?: string[];
  waybillCount?: number;
};

export type HandoverMode = "pickup" | "dropoff";

export type DropoffInfo = {
  id: string;
  status: RunBookingStatus;
  carrierName: string | null;
  bookerName: string | null;
  originCity: string;
  destCity: string;
  receivedAt: string | null;
  handoverMode: HandoverMode | null;
  waybills: Array<{ waybillId: string; waybillNumber: string | null }>;
};

function toRunBooking(raw: Record<string, unknown>): RunBooking {
  return {
    id:                    raw.id as string,
    bookerOperatorId:      raw.booker_operator_id as string,
    carrierOperatorId:     raw.carrier_operator_id as string,
    originCity:            raw.origin_city as string,
    destCity:              raw.dest_city as string,
    distanceKm:            raw.distance_km != null ? Number(raw.distance_km) : null,
    quotedRateKobo:        Number(raw.quoted_rate_kobo),
    bookingFeeKobo:        Number(raw.booking_fee_kobo),
    status:                raw.status as RunBookingStatus,
    notes:                 (raw.notes as string | null) ?? null,
    sourceRunId:           (raw.source_run_id as string | null) ?? null,
    dropoffToken:          (raw.dropoff_token as string | null) ?? null,
    dropoffTokenExpiresAt: (raw.dropoff_token_expires_at as string | null) ?? null,
    acceptedAt:            (raw.accepted_at as string | null) ?? null,
    rejectedAt:            (raw.rejected_at as string | null) ?? null,
    expiresAt:             (raw.expires_at as string | null) ?? null,
    receivedAt:            (raw.received_at as string | null) ?? null,
    pickedUpAt:            (raw.picked_up_at as string | null) ?? null,
    handoverMode:          (raw.handover_mode as HandoverMode | null) ?? null,
    createdAt:             raw.created_at as string,
    updatedAt:             raw.updated_at as string,
    bookerName:            (raw.booker_name as string | undefined) ?? undefined,
    carrierName:           (raw.carrier_name as string | undefined) ?? undefined,
    waybillIds:            (raw.waybill_ids as string[] | undefined) ?? undefined,
    waybillCount:          raw.waybill_count != null ? Number(raw.waybill_count) : undefined,
  };
}

export const runBookingApi = {
  create: (data: {
    carrierOperatorId: string;
    originCity: string;
    destCity: string;
    distanceKm?: number | null;
    quotedRateKobo: number;
    notes?: string;
    sourceRunId?: string;
    waybillIds: string[];
  }): Promise<RunBooking> =>
    apiClient
      .post<Record<string, unknown>>("/api/carriers/run-bookings", data)
      .then((r) => toRunBooking(r.data)),

  listMine: (params?: { limit?: number; offset?: number }): Promise<RunBooking[]> =>
    apiClient
      .get<{ bookings: Record<string, unknown>[] }>("/api/carriers/run-bookings", { params })
      .then((r) => r.data.bookings.map(toRunBooking)),

  getByRunId: (sourceRunId: string): Promise<RunBooking | null> =>
    apiClient
      .get<Record<string, unknown>>(`/api/carriers/run-bookings/by-run/${sourceRunId}`)
      .then((r) => toRunBooking(r.data))
      .catch((e: { response?: { status?: number } }) => e?.response?.status === 404 ? null : Promise.reject(e)),

  listIncoming: (params?: { status?: RunBookingStatus; limit?: number; offset?: number }): Promise<RunBooking[]> =>
    apiClient
      .get<{ bookings: Record<string, unknown>[] }>("/api/carriers/incoming-run-bookings", { params })
      .then((r) => r.data.bookings.map(toRunBooking)),

  accept: (bookingId: string, handoverMode: HandoverMode): Promise<RunBooking> =>
    apiClient
      .patch<Record<string, unknown>>(`/api/carriers/run-bookings/${bookingId}/accept`, { handoverMode })
      .then((r) => toRunBooking(r.data)),

  reject: (bookingId: string, notes?: string): Promise<RunBooking> =>
    apiClient
      .patch<Record<string, unknown>>(`/api/carriers/run-bookings/${bookingId}/reject`, { notes })
      .then((r) => toRunBooking(r.data)),

  getDropoffInfo: (token: string): Promise<DropoffInfo> =>
    apiClient
      .get<DropoffInfo>(`/api/carriers/run-bookings/dropoff/${token}`)
      .then((r) => r.data),

  confirmDropoff: (token: string): Promise<{ confirmedCount: number; alreadyReceived?: boolean }> =>
    apiClient
      .post<{ confirmedCount: number; alreadyReceived?: boolean }>(`/api/carriers/run-bookings/dropoff/${token}/confirm`)
      .then((r) => r.data),

  confirmPickup: (token: string): Promise<{ confirmedCount: number; alreadyReceived?: boolean; viaPickup: boolean }> =>
    apiClient
      .post<{ confirmedCount: number; alreadyReceived?: boolean; viaPickup: boolean }>(`/api/carriers/run-bookings/dropoff/${token}/pickup`)
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
