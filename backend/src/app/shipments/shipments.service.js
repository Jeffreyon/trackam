const http  = require("http");
const https = require("https");
const { URL } = require("url");
const repo = require("./shipments.repository");
const routesRepo = require("../routes/routes.repository");
const ridersRepo = require("../riders/riders.repository");
const { query } = require("../../core/db/postgres");

const OLI_SWITCH_URL = process.env.OLI_SWITCH_URL || "http://localhost:5000";

const VALID_STATUSES = ["pending", "in_transit", "delivered", "failed", "ghosted", "handed_over", "disputed"];

const VALID_TRANSITIONS = {
  pending:     ["in_transit", "failed", "handed_over"],
  in_transit:  ["delivered", "ghosted", "failed", "handed_over"],
  handed_over: ["in_transit", "delivered", "ghosted", "failed", "handed_over", "disputed"],
  ghosted:     ["in_transit", "disputed"],
  disputed:    ["in_transit", "handed_over"],
};

async function getSettings(userId) {
  const result = await query(
    `SELECT key, value FROM logistics_settings WHERE user_id = $1`,
    [userId]
  );
  const map = {};
  for (const row of result.rows) map[row.key] = row.value;
  return {
    fuelPrice: parseFloat(map.fuel_price_per_litre || "950"),
    fuelEfficiency: parseFloat(map.fuel_efficiency_multiplier || "0.12"),
    ghostThresholdHours: parseInt(map.ghost_threshold_hours || "48", 10),
  };
}

function computeRiskScore({ distanceKm, vehicleType, ghostRate, totalShipments, hasRecipientPhone }) {
  let points = 0;
  const reasons = [];

  // Distance tier
  if (distanceKm > 300) {
    points += 40; reasons.push("Very long route (>300km)");
  } else if (distanceKm > 100) {
    points += 30; reasons.push("Long route (>100km)");
  } else if (distanceKm > 25) {
    points += 20; reasons.push("Medium route (>25km)");
  } else if (distanceKm >= 15) {
    points += 10; reasons.push("Short-medium route");
  }

  // Vehicle-distance mismatch — catches physically wrong assignments
  if (vehicleType === "bike" && distanceKm > 50) {
    points += 25; reasons.push("Bike assigned to route >50km");
  } else if (vehicleType === "tricycle" && distanceKm > 30) {
    points += 15; reasons.push("Tricycle assigned to route >30km");
  } else if (vehicleType === "van" && distanceKm > 400) {
    points += 10; reasons.push("Van on very long route");
  }

  // Rider reliability
  const rate = ghostRate || 0;
  const trips = totalShipments || 0;
  if (trips === 0) {
    points += 15; reasons.push("New rider — no delivery history");
  } else if (rate > 30) {
    points += 40; reasons.push(`High ghost rate (${rate}%)`);
  } else if (rate > 20) {
    points += 30; reasons.push(`Elevated ghost rate (${rate}%)`);
  } else if (rate > 10) {
    points += 20; reasons.push(`Moderate ghost rate (${rate}%)`);
  } else if (rate > 5) {
    points += 10; reasons.push(`Low ghost rate (${rate}%)`);
  }

  // Recipient contact reduces risk — someone on the other end can confirm
  if (hasRecipientPhone) {
    points -= 10; reasons.push("Recipient contact on file (-10)");
  }

  const score = Math.max(0, points);
  const level = score >= 45 ? "high" : score >= 20 ? "medium" : "low";
  return { level, points: score, reasons };
}

async function listShipments(userId, filters = {}) {
  const settings = await getSettings(userId);
  await repo.flagDelaysAndGhosting(userId, settings.ghostThresholdHours);
  return repo.list(userId, filters);
}

async function getShipment(id, userId) {
  const settings = await getSettings(userId);
  await repo.flagDelaysAndGhosting(userId, settings.ghostThresholdHours);
  const shipment = await repo.getById(id, userId);
  if (!shipment) throw Object.assign(new Error("Shipment not found"), { status: 404 });
  return shipment;
}

async function createShipment(userId, body) {
  const {
    routeId, riderId, goodsDescription, pickupLocation, deliveryLocation,
    distanceKm, riderFee = 0, shipmentValue = 0, expectedDeliveryDate, notes,
    recipientName, recipientPhone,
  } = body;

  if (!goodsDescription || !pickupLocation || !deliveryLocation || !distanceKm) {
    throw Object.assign(
      new Error("goodsDescription, pickupLocation, deliveryLocation, and distanceKm are required"),
      { status: 400 }
    );
  }

  const settings = await getSettings(userId);
  const fuelCostNgn = Math.round(distanceKm * settings.fuelEfficiency * settings.fuelPrice);
  const fuelCostKobo = fuelCostNgn * 100;
  const riderFeeKobo = riderFee * 100;
  const totalCostKobo = fuelCostKobo + riderFeeKobo;
  const shipmentValueKobo = shipmentValue * 100;

  // Pull full rider profile for risk scoring
  let rider = null;
  if (riderId) rider = await ridersRepo.getById(riderId, userId);

  const risk = computeRiskScore({
    distanceKm,
    vehicleType: rider?.vehicleType || null,
    ghostRate: rider?.ghostRate || 0,
    totalShipments: rider?.totalShipments || 0,
    hasRecipientPhone: Boolean(recipientPhone),
  });

  const shipment = await repo.create({
    userId, routeId, riderId, goodsDescription, pickupLocation, deliveryLocation,
    distanceKm, riderFee: riderFeeKobo, fuelCost: fuelCostKobo, totalCost: totalCostKobo,
    shipmentValue: shipmentValueKobo,
    riskScore: risk.level, riskScorePoints: risk.points, riskScoreReasons: risk.reasons,
    expectedDeliveryDate, notes, recipientName, recipientPhone,
  });

  // Log initial status
  await query(
    `INSERT INTO shipment_status_log (shipment_id, old_status, new_status, note)
     VALUES ($1, NULL, 'pending', 'Shipment created')`,
    [shipment.id]
  );

  // Increment route use count if dispatched via a saved route
  if (routeId) await routesRepo.incrementUseCount(routeId);

  return shipment;
}

async function updateShipmentStatus(id, userId, body) {
  const { status, note } = body;
  if (!status || !VALID_STATUSES.includes(status)) {
    throw Object.assign(
      new Error(`status must be one of: ${VALID_STATUSES.join(", ")}`),
      { status: 400 }
    );
  }

  const current = await repo.getById(id, userId);
  if (!current) throw Object.assign(new Error("Shipment not found"), { status: 404 });

  const allowed = VALID_TRANSITIONS[current.status] || [];
  if (!allowed.includes(status)) {
    throw Object.assign(
      new Error(`Cannot transition from '${current.status}' to '${status}'`),
      { status: 409 }
    );
  }

  return repo.updateStatus(id, userId, { newStatus: status, note });
}

async function getShipmentStatusLog(id, userId) {
  const shipment = await repo.getById(id, userId);
  if (!shipment) throw Object.assign(new Error("Shipment not found"), { status: 404 });
  return repo.getStatusLog(id, userId);
}

// Operator opens a dispute on a handed_over or ghosted shipment.
// Sets status to 'disputed', which re-enables handover token creation so they can
// initiate a fresh handover once the situation is resolved.
async function reclaimShipment(userId, shipmentId, { reason } = {}) {
  const shipment = await repo.getById(shipmentId, userId);
  if (!shipment) throw Object.assign(new Error("Shipment not found"), { status: 404 });
  if (!["handed_over", "ghosted"].includes(shipment.status)) {
    throw Object.assign(
      new Error("Only handed_over or ghosted shipments can be disputed"),
      { status: 409 }
    );
  }
  const note = reason ? `Disputed: ${reason}` : "Shipment marked as disputed by operator";
  const updated = await repo.updateStatus(shipmentId, userId, { newStatus: "disputed", note });
  return updated;
}

// ── Bulk handover status sync ─────────────────────────────────────────────────
// Fetches the OLI chain for every pending/in_transit shipment that has a
// waybill_id.  If a real (non-synthetic) handover exists, the local status is
// flipped to "handed_over".

function fetchChain(waybillId) {
  const base = new URL(OLI_SWITCH_URL);
  const httpMod = base.protocol === "https:" ? https : http;

  return new Promise((resolve) => {
    const options = {
      hostname: base.hostname,
      port:     base.port || (base.protocol === "https:" ? 443 : 80),
      path:     `/api/waybill/${waybillId}/chain`,
      method:   "GET",
      headers:  { accept: "application/json" },
    };

    const req = httpMod.request(options, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        try {
          resolve(res.statusCode === 200 ? JSON.parse(raw) : null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", () => resolve(null));
    req.end();
  });
}

async function syncHandoverStatuses(userId) {
  // Find shipments that could need syncing
  const result = await query(
    `SELECT id, waybill_id FROM shipments
     WHERE user_id = $1
       AND waybill_id IS NOT NULL
       AND status IN ('pending', 'in_transit', 'disputed')`,
    [userId]
  );

  if (result.rows.length === 0) return 0;

  let synced = 0;

  // Process in batches of 10 to avoid hammering OLI switch
  const BATCH = 10;
  for (let i = 0; i < result.rows.length; i += BATCH) {
    const batch = result.rows.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (row) => {
        const data = await fetchChain(row.waybill_id);
        if (!data?.chain) return false;

        const realHandovers = data.chain.filter(
          (e) => e.giverActorType !== "ACTOR_SENDER"
        );
        if (realHandovers.length === 0) return false;

        await repo.updateStatus(row.id, userId, {
          newStatus: "handed_over",
          note: "Auto-synced from OLI custody chain",
        });
        return true;
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value === true) synced++;
    }
  }

  return synced;
}

module.exports = { listShipments, getShipment, createShipment, updateShipmentStatus, getShipmentStatusLog, reclaimShipment, syncHandoverStatuses };
