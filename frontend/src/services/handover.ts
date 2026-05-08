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
  shipment: {
    id: string;
    goodsDescription: string;
    pickupLocation: string;
    deliveryLocation: string;
    distanceKm: number;
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
  receiverBvn: string;
  receiverPhone: string | null;
  receiverActorType: ActorType;
  proofHash: string;
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
    receiverBvn: string;
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
  requestSenderOtp: (phone: string) =>
    axios.post<{ verificationId: string }>(`${publicBase()}/api/waybill/request-sender-otp`, { phone }).then((r) => r.data),
  verifySenderOtp: (verificationId: string, otp: string) =>
    axios.post<{ verificationToken: string; phone: string }>(`${publicBase()}/api/waybill/verify-sender-otp`, { verificationId, otp }).then((r) => r.data),
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
