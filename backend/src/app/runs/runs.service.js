const repo = require("./runs.repository");
const { query } = require("../../core/db/postgres");

const VALID_TRANSITIONS = {
  loading:    ["in_transit", "cancelled"],
  in_transit: ["completed", "cancelled"],
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

async function createRun(userId, body) {
  const { name, riderId, notes, distanceKm, riderFee, expectedDeliveryDate } = body;

  let fuelCostKobo = 0;
  let riderFeeKobo = 0;
  let totalCostKobo = 0;
  const dist = parseInt(distanceKm, 10) || 0;

  if (dist > 0 || riderFee) {
    const settings = await getSettings(userId);
    const fuelCostNgn = Math.round(dist * settings.fuelEfficiency * settings.fuelPrice);
    fuelCostKobo = fuelCostNgn * 100;
    riderFeeKobo = (parseInt(riderFee, 10) || 0) * 100;
    totalCostKobo = fuelCostKobo + riderFeeKobo;
  }

  return repo.create({
    userId, name, riderId, notes,
    distanceKm: dist,
    riderFee: riderFeeKobo,
    fuelCost: fuelCostKobo,
    totalCost: totalCostKobo,
    expectedDeliveryDate,
  });
}

async function listRuns(userId) {
  const settings = await getSettings(userId);
  await repo.flagDelaysAndGhosting(userId, settings.ghostThresholdHours);
  return repo.listByUser(userId);
}

async function getRunDetail(userId, runId) {
  const settings = await getSettings(userId);
  await repo.flagDelaysAndGhosting(userId, settings.ghostThresholdHours);
  const run = await repo.getById(runId, userId);
  if (!run) throw Object.assign(new Error("Dispatch run not found"), { status: 404 });
  return run;
}

async function addLeg(userId, runId, { shipmentId }) {
  if (!shipmentId) throw Object.assign(new Error("shipmentId is required"), { status: 400 });
  try {
    await repo.addLeg(runId, shipmentId, userId);
  } catch (err) {
    if (err.code === "23505") {
      throw Object.assign(new Error("This shipment is already assigned to a run"), { status: 409 });
    }
    throw err;
  }
  return repo.getById(runId, userId);
}

async function removeLeg(userId, runId, shipmentId) {
  await repo.removeLeg(runId, shipmentId, userId);
  return repo.getById(runId, userId);
}

async function updateStatus(userId, runId, { status }) {
  if (!status) throw Object.assign(new Error("status is required"), { status: 400 });

  const run = await repo.getById(runId, userId);
  if (!run) throw Object.assign(new Error("Dispatch run not found"), { status: 404 });

  const allowed = VALID_TRANSITIONS[run.status] || [];
  if (!allowed.includes(status)) {
    throw Object.assign(
      new Error(`Cannot transition run from '${run.status}' to '${status}'`),
      { status: 409 }
    );
  }

  const updated = await repo.updateStatus(runId, userId, status);
  if (!updated) throw Object.assign(new Error("Dispatch run not found"), { status: 404 });
  return updated;
}

async function updateRun(userId, runId, body) {
  const run = await repo.getById(runId, userId);
  if (!run) throw Object.assign(new Error("Dispatch run not found"), { status: 404 });

  const fields = {};
  if ("name" in body) fields.name = body.name;
  if ("riderId" in body) fields.riderId = body.riderId;
  if ("notes" in body) fields.notes = body.notes;
  if ("expectedDeliveryDate" in body) fields.expectedDeliveryDate = body.expectedDeliveryDate;

  if ("distanceKm" in body || "riderFee" in body) {
    const settings = await getSettings(userId);
    const dist = "distanceKm" in body ? (parseInt(body.distanceKm, 10) || 0) : run.distanceKm;
    const fee = "riderFee" in body ? (parseInt(body.riderFee, 10) || 0) * 100 : run.riderFee;
    const fuelCostNgn = Math.round(dist * settings.fuelEfficiency * settings.fuelPrice);
    const fuelCostKobo = fuelCostNgn * 100;
    fields.distanceKm = dist;
    fields.riderFee = fee;
    fields.fuelCost = fuelCostKobo;
    fields.totalCost = fuelCostKobo + fee;
  }

  const updated = await repo.update(runId, userId, fields);
  if (!updated) throw Object.assign(new Error("Dispatch run not found"), { status: 404 });
  return updated;
}

module.exports = { createRun, listRuns, getRunDetail, addLeg, removeLeg, updateStatus, updateRun };
