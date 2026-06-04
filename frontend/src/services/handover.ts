import { apiClient } from "@/lib/apiClient";
import axios from "axios";

export type ActorType = "ACTOR_SENDER" | "ACTOR_COURIER" | "ACTOR_HUB" | "ACTOR_RECEIVER";

export const ACTOR_LABELS: Record<ActorType, string> = {
  ACTOR_SENDER:   "Sender / Merchant",
  ACTOR_COURIER:  "Courier / Driver",
  ACTOR_HUB:      "Hub / Warehouse Staff",
  ACTOR_RECEIVER: "Receiver / Customer",
};

export interface HandoverToken {
  token: string;
  expiresAt: string;
  shipmentId: string;
}

export interface TokenInfo {
  token: string;
  expiresAt: string;
  giverActorType: ActorType;
  receiverActorType?: ActorType;
  giverName: string | null;
  idScheme: string;
  shipment: {
    id: string;
    goodsDescription: string;
    pickupLocation: string;
    deliveryLocation: string;
    status: string;
  };
}

export interface HandoverConfirmation {
  proofHash: string;
  occurredAt: string;
  shipmentId: string;
  receiverName: string;
  receiverActorType: ActorType;
}

export interface HandoverEvent {
  id: string;
  shipmentId: string;
  giverActorType: ActorType;
  receiverName: string;
  receiverIdHash: string;
  receiverIdScheme: string;
  receiverPhone: string | null;
  receiverActorType: ActorType;
  proofHash: string;
  idVerified: boolean;
  idOverride: boolean;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
}

export const handoverApi = {
  initiate: (shipmentId: string, actorType: ActorType = "ACTOR_COURIER") =>
    apiClient.post<HandoverToken>("/api/handover/initiate", { shipmentId, actorType }).then((r) => r.data),

  getEvents: (shipmentId: string) =>
    apiClient.get<HandoverEvent[]>(`/api/handover/shipment/${shipmentId}/events`).then((r) => r.data),

  initiateBulk: (body: {
    shipmentIds: string[];
    receiverActorType: ActorType;
    giverActorType?: ActorType;
    runId?: string;
    internal?: boolean;
  }) =>
    apiClient.post<BulkHandoverInitiated>("/api/handover/initiate-bulk", body).then((r) => r.data),
};

// Public API calls — no auth header, using raw axios pointed at same base
function publicBase() {
  const cfg = (window as unknown as { __APP_CONFIG__?: { VITE_API_URL?: string } }).__APP_CONFIG__;
  return cfg?.VITE_API_URL || import.meta.env.VITE_API_URL || "";
}

export interface DeliveryOtpRequested {
  sent: boolean;
  channel: "sms" | "email" | "none";
  maskedPhone: string;
  // Receiver name + goods description come from the canonical waybill record
  // so authenticated drivers/staff can display "Delivering to: X" inline
  // without an extra waybill fetch. Caller passes receiverName back at confirm.
  receiverName: string | null;
  goodsDescription: string | null;
  expiresInSec: number;
}

export const publicHandoverApi = {
  getTokenInfo: (token: string) =>
    axios.get<TokenInfo>(`${publicBase()}/api/handover/token/${token}`).then((r) => r.data),

  // Sends a 6-digit code to the receiver's phone as recorded on the waybill.
  // Only valid for ACTOR_RECEIVER tokens (final-mile delivery).
  requestDeliveryOtp: (token: string) =>
    axios.post<DeliveryOtpRequested>(`${publicBase()}/api/handover/request-delivery-otp`, { token })
      .then((r) => r.data),

  confirm: (body: {
    token: string;
    receiverName: string;
    receiverPhone?: string;
    receiverActorType: ActorType;
    latitude?: number;
    longitude?: number;
    otp?: string;
  }) =>
    axios.post<HandoverConfirmation>(`${publicBase()}/api/handover/confirm`, body).then((r) => r.data),

  // Receiving-rider variant: no form. OLI Switch resolves the rider via the
  // network_riders index keyed by the phone in their phoneToken. Used by
  // /handover/driver?join=<token> for single-shipment handover tokens.
  confirmAsRider: (body: {
    token: string;
    phoneToken: string;
    latitude?: number;
    longitude?: number;
  }) =>
    axios.post<HandoverConfirmation>(`${publicBase()}/api/handover/confirm-as-rider`, body).then((r) => r.data),

  // Bulk variant of confirmAsRider — for dispatch-run batch tokens.
  // Same phone-token identity derivation, confirms all shipments in one call.
  confirmBulkAsRider: (body: {
    token: string;
    phoneToken: string;
    latitude?: number;
    longitude?: number;
  }) =>
    axios.post<BulkHandoverConfirmed>(`${publicBase()}/api/handover/confirm-bulk-as-rider`, body).then((r) => r.data),
};

export const publicWaybillApi = {
  get: (id: string) =>
    axios.get(`${publicBase()}/api/waybill/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) =>
    axios.post(`${publicBase()}/api/waybill`, data).then((r) => r.data),
  pdfUrl: (id: string) => `${publicBase()}/api/waybill/${id}/pdf`,
  getChain: (id: string) =>
    axios.get(`${publicBase()}/api/waybill/${id}/chain`).then((r) => r.data),
  lookup: (waybillNumber: string) =>
    axios.get(`${publicBase()}/api/waybill/lookup/${encodeURIComponent(waybillNumber)}`).then((r) => r.data),
};

// ── Identity verification for TrackWaybillPage ───────────────────────────────

export interface WaybillVerifyResult {
  token: string;
  role: "sender" | "receiver";
  expiresAt: string;
}

export const waybillVerifyApi = {
  /** Send OTP to phone — silent success even if phone doesn't match (anti-enumeration) */
  requestOtp: (waybillId: string, phone: string) =>
    axios.post<{ sent: boolean }>(
      `${publicBase()}/api/waybill/${waybillId}/verify/request-otp`,
      { phone }
    ).then((r) => r.data),

  /** Submit OTP → returns a 1-hour JWT if correct */
  confirmOtp: (waybillId: string, phone: string, otp: string) =>
    axios.post<WaybillVerifyResult>(
      `${publicBase()}/api/waybill/${waybillId}/verify/confirm-otp`,
      { phone, otp }
    ).then((r) => r.data),

  /** Fetch full chain (with names) using the verify JWT */
  getChain: (waybillId: string, token: string) =>
    axios.get(
      `${publicBase()}/api/waybill/${waybillId}/chain/verified`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then((r) => r.data),
};

export interface OperatorWaybill {
  id: string;
  waybillNumber: string;
  goodsDescription: string;
  pickupLocation: string;
  deliveryLocation: string;
  estimatedWeightKg: number | null;
  claimedAt: string;
  handoverCount: number;
  isDelivered: boolean;
  senderName: string;
  receiverName: string;
  // Dispatch run assignment
  shipmentId: string | null;
  runId: string | null;
  runName: string | null;
  runStatus: string | null;
}

export const waybillApi = {
  list: () =>
    apiClient.get<OperatorWaybill[]>(`/api/waybill/mine`).then((r) => r.data),
  claim: (data: { waybillNumber: string; claimToken: string }) =>
    apiClient.post<{ shipmentId: string }>(`/api/waybill/claim`, data).then((r) => r.data),
  joinLeg: (waybillId: string, proofHash: string) =>
    apiClient.post<{ shipmentId: string; waybillId: string }>(`/api/waybill/${waybillId}/join-leg`, { proofHash }).then((r) => r.data),
  confirmAndJoin: (token: string, receiverName: string) =>
    apiClient.post<{ proofHash: string; shipmentId: string; waybillId: string }>(`/api/waybill/confirm-and-join`, { token, receiverName }).then((r) => r.data),
  lookupId: (waybillNumber: string) =>
    axios.get<{ id: string }>(`${publicBase()}/api/waybill/lookup/${encodeURIComponent(waybillNumber)}`).then((r) => r.data),
};

export interface RunShipmentItem {
  shipmentId: string;
  waybillId: string | null;
  waybillNumber: string | null;
  goodsDescription: string | null;
  pickupLocation: string | null;
  deliveryLocation: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  shipmentValue: number;
}

export interface CustodyInfo {
  sessionId: string;
  name: string;
  actorType: ActorType;
  // Single-shipment sessions
  shipment?: {
    goodsDescription: string;
    pickupLocation: string;
    deliveryLocation: string;
    status: string;
  };
  waybillId?: string | null;
  waybillNumber?: string | null;
  // Run sessions
  mode?: "run";
  runId?: string;
  shipments?: RunShipmentItem[];
  startedAt?: string;
  progress?: {
    total: number;
    delivered: number;
    remaining: number;
    totalValue: number;      // kobo
    remainingValue: number;  // kobo
  };
}

export interface BatchTokenInfo {
  batchId: string;
  receiverActorType: ActorType;
  runId: string | null;
  internal: boolean;
  expiresAt: string;
  shipments: Array<{
    shipmentId: string;
    waybillNumber: string | null;
    goodsDescription: string | null;
    pickupLocation: string | null;
    deliveryLocation: string | null;
    shipmentValue: number;
  }>;
}

export interface BulkHandoverInitiated {
  token: string;
  expiresAt: string;
  shipmentCount: number;
}

export interface BulkHandoverConfirmed {
  confirmedCount: number;
  totalFee: number;
  custodianToken: string | null;
  proofHashes: Array<{ shipmentId: string; proofHash: string }>;
}

// Public custodian API — no operator auth, uses per-request custodian JWT
export const custodianApi = {
  requestOtp: (body: { sessionId: string; phone: string }) =>
    axios.post(`${publicBase()}/api/custodian/request-otp`, body).then((r) => r.data),

  verifyOtp: (body: { sessionId: string; otp: string }) =>
    axios.post<{ token: string; name: string; actorType: ActorType; shipmentId: string }>(
      `${publicBase()}/api/custodian/verify-otp`,
      body
    ).then((r) => r.data),

  getMe: (custodianToken: string) =>
    axios.get<CustodyInfo>(`${publicBase()}/api/custodian/me`, {
      headers: { Authorization: `Bearer ${custodianToken}` },
    }).then((r) => r.data),

  initiateHandover: (custodianToken: string, actorType: ActorType, shipmentId?: string) =>
    axios.post<HandoverToken>(
      `${publicBase()}/api/custodian/initiate-handover`,
      { actorType, ...(shipmentId ? { shipmentId } : {}) },
      { headers: { Authorization: `Bearer ${custodianToken}` } }
    ).then((r) => r.data),

  resendLink: (phone: string) =>
    axios.post<{ sent: boolean; sessionId: string }>(`${publicBase()}/api/custodian/resend-link`, { phone }).then((r) => r.data),

  initiateBulkHandover: (custodianToken: string, actorType: ActorType) =>
    axios.post<BulkHandoverInitiated>(
      `${publicBase()}/api/custodian/initiate-bulk-handover`,
      { actorType },
      { headers: { Authorization: `Bearer ${custodianToken}` } }
    ).then((r) => r.data),

  // ── Find-my-custody flow ─────────────────────────────────────────────────
  requestOtpByPhone: (phone: string) =>
    axios.post<{ sent: boolean; channel?: string }>(
      `${publicBase()}/api/custodian/request-otp-by-phone`,
      { phone }
    ).then((r) => r.data),

  verifyOtpByPhone: (phone: string, otp: string) =>
    axios.post<{
      sessions: CustodySessionSummary[];
      phone: string;
      phoneToken: string;
      phoneTokenExpiresAt: string;
    }>(
      `${publicBase()}/api/custodian/verify-otp-by-phone`,
      { phone, otp }
    ).then((r) => r.data),

  // Resume an existing phone session (no OTP needed) using a long-lived phone
  // token saved in localStorage. Throws 401 when the token has expired.
  sessionsByPhoneToken: (phoneToken: string) =>
    axios.get<{ sessions: CustodySessionSummary[]; phone: string }>(
      `${publicBase()}/api/custodian/sessions/by-phone-token`,
      { headers: { Authorization: `Bearer ${phoneToken}` } }
    ).then((r) => r.data),
};

export interface CustodySessionSummary {
  sessionId:          string;
  token:              string;
  mode:               "run" | "single" | "unknown";
  receiverName:       string;
  receiverActorType:  ActorType;
  // single-shipment sessions
  shipment: {
    goodsDescription: string;
    pickupLocation:   string;
    deliveryLocation: string;
    status:           string;
  } | null;
  waybillId: string | null;
  // run sessions
  runId:              string | null;
  remainingShipments: number | null;
  totalShipments:     number | null;
  pickupSample:       string | null;
  deliverySample:     string | null;
  createdAt:          string;
}

export const publicBatchApi = {
  getInfo: (token: string) =>
    axios.get<BatchTokenInfo>(`${publicBase()}/api/handover/batch/${token}`).then((r) => r.data),

  confirm: (body: {
    token: string;
    receiverName: string;
    receiverPhone?: string;
    receiverActorType: ActorType;
    latitude?: number;
    longitude?: number;
  }) =>
    axios.post<BulkHandoverConfirmed>(`${publicBase()}/api/handover/confirm-bulk`, body).then((r) => r.data),
};

// ── Wallet ────────────────────────────────────────────────────────────────────

export interface WalletData {
  id: string;
  operator_id: string;
  balance: number;
  currency: string;
  updated_at: string;
}

export interface TopupInit {
  authorization_url: string;
  access_code?: string;
  reference: string;
}

export interface WalletTransaction {
  id: string;
  operator_id: string;
  type: "credit" | "debit";
  amount: number;
  balance_after: number;
  description: string | null;
  reference: string | null;
  created_at: string;
}

export const walletApi = {
  get: () => apiClient.get<{ wallet: WalletData }>("/api/wallet").then((r) => r.data.wallet),
  transactions: () =>
    apiClient.get<WalletTransaction[]>("/api/wallet/transactions").then((r) => r.data),
  topup: (amountNgn: number) =>
    apiClient.post<TopupInit>("/api/wallet/topup", { amount: amountNgn }).then((r) => r.data),
};
