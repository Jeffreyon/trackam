const repo = require("./runs.repository");

const VALID_TRANSITIONS = {
  loading:    ["in_transit", "cancelled"],
  in_transit: ["completed", "cancelled"],
};

async function createRun(userId, body) {
  const { name, riderId, notes } = body;
  return repo.create({ userId, name, riderId, notes });
}

async function listRuns(userId) {
  return repo.listByUser(userId);
}

async function getRunDetail(userId, runId) {
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
  const updated = await repo.update(runId, userId, body);
  if (!updated) throw Object.assign(new Error("Dispatch run not found"), { status: 404 });
  return updated;
}

module.exports = { createRun, listRuns, getRunDetail, addLeg, removeLeg, updateStatus, updateRun };
