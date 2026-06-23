const express = require("express");
const router = express.Router();
const localAuthMiddleware = require("../../core/middlewares/localAuth");
const asyncHandler = require("../../core/middlewares/asyncHandler");
const ShipmentsService = require("./shipments.service");

// GS1 CBV bizStep mapping
const OLI_OPERATOR_ID       = process.env.OLI_OPERATOR_ID       || "";
const OLI_TRACKING_ENDPOINT = process.env.OLI_TRACKING_ENDPOINT || "";

const BIZ_STEP = {
  pending:     "urn:epcglobal:cbv:bizstep:staging_outbound",
  in_transit:  "urn:epcglobal:cbv:bizstep:in_transit",
  handed_over: "urn:epcglobal:cbv:bizstep:receiving",
  delivered:   "urn:epcglobal:cbv:bizstep:delivering",
  failed:      "urn:epcglobal:cbv:bizstep:void_shipping",
  ghosted:     "urn:ol:cbv:bizstep:ghosted",
  disputed:    "urn:ol:cbv:bizstep:ghosted",
};

const DISPOSITION = {
  pending:     "urn:epcglobal:cbv:disp:in_progress",
  in_transit:  "urn:epcglobal:cbv:disp:in_transit",
  handed_over: "urn:epcglobal:cbv:disp:in_progress",
  delivered:   "urn:epcglobal:cbv:disp:completeness_verified",
  failed:      "urn:epcglobal:cbv:disp:no_pedigree_match",
  ghosted:     "urn:ol:cbv:disp:ghosted",
  disputed:    "urn:ol:cbv:disp:ghosted",
};

// custodyType: in_transit shipments with a rider are RIDER_IN_TRANSIT; everything else is OPERATOR_HUB
function custodyType(s) {
  return (s.status === "in_transit" && s.riderId) ? "RIDER_IN_TRANSIT" : "OPERATOR_HUB";
}

function toJsonLd(s, baseUrl) {
  const trackingBase = OLI_TRACKING_ENDPOINT || baseUrl;
  // Use the waybill UUID when available so multi-operator legs share the same EPC
  const epc = s.waybillId ? `urn:ol:waybill:${s.waybillId}` : `urn:ol:waybill:${s.id}`;

  const doc = {
    "@context": [
      "https://ref.gs1.org/standards/epcis/epcis-context.jsonld",
      "https://raw.githubusercontent.com/open-logistics-ng/schema/main/context.jsonld",
    ],
    "@type": "ObjectEvent",
    "@id": `${baseUrl}/api/shipments/${s.id}`,
    "eventTime": s.lastStatusUpdateAt,
    "eventTimeZoneOffset": "+01:00",
    "epcList": [epc],
    "action": "OBSERVE",
    "bizStep": BIZ_STEP[s.status] || BIZ_STEP.pending,
    "disposition": DISPOSITION[s.status] || DISPOSITION.pending,
    "bizLocation": {
      "@type": "BusinessLocation",
      "id": `urn:ol:location:${encodeURIComponent(s.pickupLocation)}`,
      "label": s.pickupLocation,
    },
    "destination": {
      "@type": "BusinessLocation",
      "id": `urn:ol:location:${encodeURIComponent(s.deliveryLocation)}`,
      "label": s.deliveryLocation,
    },
    "ol:goodsDescription": s.goodsDescription,
    "ol:distanceKm": s.distanceKm,
    "ol:riskScore": s.riskScore,
    "ol:totalCostKobo": s.totalCost,
    "ol:shipmentValueKobo": s.shipmentValue,
    "ol:status": s.status,
    "ol:delayFlag": s.delayFlag,
    "ol:ghostingFlag": s.ghostingFlag,
  };

  // currentCustodian: included when this operator is the active custodian.
  // The switch follows this pointer for federated tracking resolution.
  if (OLI_OPERATOR_ID && ["pending", "in_transit", "handed_over"].includes(s.status)) {
    doc["ol:currentCustodian"] = {
      "@type": "ol:Operator",
      "ol:operatorId": OLI_OPERATOR_ID,
      "ol:trackingEndpoint": trackingBase,
      "ol:custodyType": custodyType(s),
    };
  }

  return doc;
}

router.use(localAuthMiddleware);

// ── POST /sync-handover-status — bulk-sync from OLI custody chains ──────────
// Finds all pending/in_transit shipments with waybill IDs, checks the OLI
// chain for real handovers, and updates local status to "handed_over" where
// needed.  Called by ShipmentsPage on mount so the table always reflects the
// latest custody state without visiting each shipment individually.

router.post("/sync-handover-status", asyncHandler(async (req, res) => {
  const synced = await ShipmentsService.syncHandoverStatuses(req.user.uid);
  res.json({ synced });
}));

router.get("/", asyncHandler(async (req, res) => {
  const { status, riderId, limit, offset } = req.query;
  const shipments = await ShipmentsService.listShipments(req.user.uid, {
    status,
    riderId,
    limit: limit ? parseInt(limit, 10) : 50,
    offset: offset ? parseInt(offset, 10) : 0,
  });
  res.json(shipments);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const shipment = await ShipmentsService.getShipment(req.params.id, req.user.uid);
  const accept = req.headers["accept"] || "";
  if (accept.includes("application/ld+json")) {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    return res.set("Content-Type", "application/ld+json").json(toJsonLd(shipment, baseUrl));
  }
  res.json(shipment);
}));

router.get("/:id/log", asyncHandler(async (req, res) => {
  res.json(await ShipmentsService.getShipmentStatusLog(req.params.id, req.user.uid));
}));

router.post("/", asyncHandler(async (req, res) => {
  const shipment = await ShipmentsService.createShipment(req.user.uid, req.body);
  res.status(201).json(shipment);
}));

router.patch("/:id/status", asyncHandler(async (req, res) => {
  res.json(await ShipmentsService.updateShipmentStatus(req.params.id, req.user.uid, req.body));
}));

// Operator disputes a handed_over or ghosted shipment so they can re-initiate handover
router.post("/:id/reclaim", asyncHandler(async (req, res) => {
  res.json(await ShipmentsService.reclaimShipment(req.user.uid, req.params.id, req.body));
}));

// Archive / unarchive a shipment from the waybills view
router.post("/:id/archive", asyncHandler(async (req, res) => {
  const { unarchive } = req.body;
  const { query } = require("../../core/db/postgres");
  const result = await query(
    `UPDATE shipments
     SET archived_at = ${unarchive ? "NULL" : "NOW()"}
     WHERE id = $1 AND user_id = $2
     RETURNING id, archived_at`,
    [req.params.id, req.user.uid]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Shipment not found" });
  res.json({ archived: !unarchive, archivedAt: result.rows[0].archived_at });
}));

module.exports = router;
