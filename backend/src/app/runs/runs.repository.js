const { query } = require("../../core/db/postgres");

function mapRun(row) {
  if (!row) return null;
  return {
    id:          row.id,
    userId:      row.user_id,
    name:        row.name || null,
    riderId:     row.rider_id || null,
    riderName:   row.rider_name || null,
    status:      row.status,
    notes:       row.notes || null,
    departedAt:  row.departed_at || null,
    completedAt: row.completed_at || null,
    legCount:    Number(row.leg_count || 0),
    totalValue:  Number(row.total_value || 0),
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

function mapLeg(row) {
  if (!row) return null;
  return {
    id:               row.leg_id,
    shipmentId:       row.shipment_id,
    waybillId:        row.waybill_id || null,
    waybillNumber:    row.waybill_number || null,
    goodsDescription: row.goods_description,
    pickupLocation:   row.pickup_location,
    deliveryLocation: row.delivery_location,
    status:           row.shipment_status,
    recipientName:    row.recipient_name || null,
    recipientPhone:   row.recipient_phone || null,
    shipmentValue:    Number(row.shipment_value || 0),
    handoverCount:    Number(row.handover_count || 0),
    addedAt:          row.added_at,
  };
}

async function create({ userId, name, riderId, notes }) {
  const result = await query(
    `INSERT INTO dispatch_runs (user_id, name, rider_id, notes)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, name || null, riderId || null, notes || null]
  );
  return mapRun(result.rows[0]);
}

async function listByUser(userId) {
  const result = await query(
    `SELECT
       dr.*,
       r.name AS rider_name,
       COUNT(s.id)::int                  AS leg_count,
       COALESCE(SUM(s.shipment_value), 0) AS total_value
     FROM dispatch_runs dr
     LEFT JOIN riders r   ON r.id = dr.rider_id
     LEFT JOIN shipments s ON s.run_id = dr.id
     WHERE dr.user_id = $1
     GROUP BY dr.id, r.name
     ORDER BY dr.created_at DESC`,
    [userId]
  );
  return result.rows.map(mapRun);
}

async function getById(runId, userId) {
  const runResult = await query(
    `SELECT
       dr.*,
       r.name AS rider_name,
       COUNT(s.id)::int                  AS leg_count,
       COALESCE(SUM(s.shipment_value), 0) AS total_value
     FROM dispatch_runs dr
     LEFT JOIN riders r    ON r.id = dr.rider_id
     LEFT JOIN shipments s ON s.run_id = dr.id
     WHERE dr.id = $1 AND dr.user_id = $2
     GROUP BY dr.id, r.name`,
    [runId, userId]
  );
  const run = mapRun(runResult.rows[0]);
  if (!run) return null;

  const legsResult = await query(
    `SELECT
       s.id               AS leg_id,
       s.id               AS shipment_id,
       s.updated_at       AS added_at,
       s.waybill_id,      lw.waybill_number,
       s.goods_description, s.pickup_location, s.delivery_location,
       s.status           AS shipment_status,
       s.recipient_name, s.recipient_phone, s.shipment_value,
       (SELECT COUNT(*) FROM handover_events he
        WHERE he.shipment_id = s.id)::int AS handover_count
     FROM shipments s
     LEFT JOIN lite_waybills lw ON lw.id = s.waybill_id
     WHERE s.run_id = $1
     ORDER BY s.updated_at`,
    [runId]
  );

  return { ...run, legs: legsResult.rows.map(mapLeg) };
}

async function addLeg(runId, shipmentId, userId) {
  // Verify run belongs to user and is still loading
  const runCheck = await query(
    `SELECT id, status FROM dispatch_runs WHERE id = $1 AND user_id = $2`,
    [runId, userId]
  );
  if (!runCheck.rows[0]) throw Object.assign(new Error("Run not found"), { status: 404 });
  if (runCheck.rows[0].status !== "loading") {
    throw Object.assign(new Error("Cannot add shipments to a run that has already departed"), { status: 409 });
  }

  // Assign run_id on the shipment — fail if already in a different run
  const result = await query(
    `UPDATE shipments
        SET run_id = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
        AND (run_id IS NULL OR run_id = $1)
      RETURNING id`,
    [runId, shipmentId, userId]
  );
  if (!result.rows[0]) {
    // Check why: shipment not found vs already assigned to another run
    const s = await query(`SELECT run_id FROM shipments WHERE id = $1 AND user_id = $2`, [shipmentId, userId]);
    if (!s.rows[0]) throw Object.assign(new Error("Shipment not found"), { status: 404 });
    throw Object.assign(new Error("This shipment is already assigned to another run"), { status: 409 });
  }
}

async function removeLeg(runId, shipmentId, userId) {
  const runCheck = await query(
    `SELECT id, status FROM dispatch_runs WHERE id = $1 AND user_id = $2`,
    [runId, userId]
  );
  if (!runCheck.rows[0]) throw Object.assign(new Error("Run not found"), { status: 404 });
  if (runCheck.rows[0].status !== "loading") {
    throw Object.assign(new Error("Cannot remove shipments after departure"), { status: 409 });
  }

  await query(
    `UPDATE shipments
        SET run_id = NULL, updated_at = NOW()
      WHERE id = $1 AND run_id = $2 AND user_id = $3`,
    [shipmentId, runId, userId]
  );
}

async function updateStatus(runId, userId, status) {
  if (status === "in_transit") {
    const r = await query(
      `UPDATE dispatch_runs SET status=$1, departed_at=NOW(), updated_at=NOW()
       WHERE id=$2 AND user_id=$3 RETURNING *`,
      [status, runId, userId]
    );
    return mapRun(r.rows[0]);
  } else if (status === "completed") {
    const r = await query(
      `UPDATE dispatch_runs SET status=$1, completed_at=NOW(), updated_at=NOW()
       WHERE id=$2 AND user_id=$3 RETURNING *`,
      [status, runId, userId]
    );
    return mapRun(r.rows[0]);
  } else {
    const r = await query(
      `UPDATE dispatch_runs SET status=$1, updated_at=NOW()
       WHERE id=$2 AND user_id=$3 RETURNING *`,
      [status, runId, userId]
    );
    return mapRun(r.rows[0]);
  }
}

async function update(runId, userId, { name, riderId, notes }) {
  const r = await query(
    `UPDATE dispatch_runs SET name=$1, rider_id=$2, notes=$3, updated_at=NOW()
     WHERE id=$4 AND user_id=$5 RETURNING *`,
    [name || null, riderId || null, notes || null, runId, userId]
  );
  return mapRun(r.rows[0]);
}

module.exports = { create, listByUser, getById, addLeg, removeLeg, updateStatus, update };
