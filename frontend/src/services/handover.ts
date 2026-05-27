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
};

// Public API calls — no auth header, using raw axios pointed at same base
function publicBase() {
  const cfg = (window as unknown as { __APP_CONFIG__?: { VITE_API_URL?: string } }).__APP_CONFIG__;
  return cfg?.VITE_API_URL || import.meta.env.VITE_API_URL || "";
}

export const publicHandoverApi = {
  getTokenInfo: (token: string) =>
    axios.get<TokenInfo>(`${publicBase()}/api/handover/token/${token}`).then((r) => r.data),

  confirm: (body: {
    token: string;
    receiverName: string;
    receiverGovtId: string;
    receiverPhone?: string;
    receiverActorType: ActorType;
    latitude?: number;
    longitude?: number;
  }) =>
    axios.post<HandoverConfirmation>(`${publicBase()}/api/handover/confirm`, body).then((r) => r.data),
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
  lookupId: (waybillNumber: string) =>
    axios.get<{ id: string }>(`${publicBase()}/api/waybill/lookup/${encodeURIComponent(waybillNumber)}`).then((r) => r.data),
};

export interface CustodyInfo {
  sessionId: string;
  name: string;
  actorType: ActorType;
  shipment: {
    goodsDescription: string;
    pickupLocation: string;
    deliveryLocation: string;
    status: string;
  };
  waybillId: string | null;
  waybillNumber: string | null;
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

  initiateHandover: (custodianToken: string, actorType: ActorType) =>
    axios.post<HandoverToken>(
      `${publicBase()}/api/custodian/initiate-handover`,
      { actorType },
      { headers: { Authorization: `Bearer ${custodianToken}` } }
    ).then((r) => r.data),

  resendLink: (phone: string) =>
    axios.post<{ sent: boolean; sessionId: string }>(`${publicBase()}/api/custodian/resend-link`, { phone }).then((r) => r.data),
};
