# Gap Analysis

## Current state summary

Trackam is a commercial operator platform with full dispatch, rider management, multi-operator waybills, PoH chain, custodian OTP sessions, disputes, cost accounting, and a Phase 1 founder admin dashboard. The OLI Switch integration is live with a network-wide rider identity index. Core infrastructure is production-grade.

## Open gaps

### OLI Switch integration

| Gap | Detail |
|---|---|
| Webhook dead letter visibility | No UI to see failed webhook deliveries or retry them manually |
| Custodian session visibility | No operator-facing view of active/expired custodian sessions for a shipment |
| Per-operator rate limiting | Rate limiting is currently global on the switch, not per-operator |
| Idempotency keys | Critical write endpoints (initiate handover, confirm handover) have no idempotency key support |

### Waybill and shipment

| Gap | Detail |
|---|---|
| Waybill search and filter | No `?waybillNumber=`, `?status=`, `?dateFrom=`, `?dateTo=` filters on the waybill list |
| Waybill cancellation | No `POST /api/waybill/:id/cancel` endpoint |
| OTP brute force protection | No lockout after repeated failed OTP attempts on custodian sessions |

### Dispute lifecycle

| Gap | Detail |
|---|---|
| Dispute timeout | No auto-close or admin alert for disputes stale beyond 30 days |

### Operator tooling

| Gap | Detail |
|---|---|
| Fee invoice / billing statement | No period-based exportable fee summary (PDF or CSV) |

### Live tracking

| Gap | Detail |
|---|---|
| Decentralized tracking layer | The federated live tracking protocol (JSON-LD stream, per-custody-session credentials, signed GPS payloads) is designed but not yet implemented |
| Condition monitoring | No environmental parameter (temperature, humidity) support for cold chain operators |

### Platform hardening

| Gap | Detail |
|---|---|
| Mobile dashboard navigation | No drawer/sheet nav pattern for small screens |
| Event ingestion | Public `POST /api/events` is still open |
| Backend lint and typecheck scripts | Not yet present |

## What is not a gap

- The PoH chain — implemented and production-grade
- Atomic handover token claiming (TOCTOU-safe) — implemented
- Wallet, fees, and disputes on the switch — implemented
- Webhook retry queue with exponential backoff — implemented
- BVN verification with bypass and caching — implemented
- Graceful shutdown — implemented
- Phone normalization — implemented
- SSE heartbeat and zombie connection cleanup — implemented
- GPS auto-capture on scan and handover pages — implemented
- OTP-based delivery confirmation (ScanPage, DriverHandoverPage, StaffHandoverPage) — implemented
- Rider government ID capture at onboarding — implemented
- Admin identity verification queue (riders + staff, with photo review) — implemented
- Rider snapshot push to OLI Switch network index (`network_riders`) — implemented
- Phase 1 commercial layer: org-level OLI API key, `owner` role, first-signup auto-promotion — implemented
- Admin dashboard (org settings, OLI connection, wallet, user management, roles, events, identity verification) — implemented, dark theme matching operator UI
- Receiver identity derived from custodian session — no manual form for hub/rider actors — implemented
