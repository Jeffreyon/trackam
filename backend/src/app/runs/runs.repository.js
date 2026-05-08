const { query } = require("../../core/db/postgres");

function mapRun(row) {
  if (!row) return null;
  return {
    id:           row.id,
    userId:       row.user_id,
    name:         row.name || null,
    riderId:      row.rider_id || null,
    riderName:    row.rider_name || null,
    status:       row.status,
    notes:        row.notes || null,
    departedAt:   row.departed_at || null,
    completedAt:  row.completed_at || null,
    legCount:     Number(row.leg_count || 0),
    totalValue:   Number(row.total_value || 0),
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  };
}

function mapLeg(row) {
  if (!row) return null;
  return {
    id:                row.leg_id,
    shipmentId:        row.shipment_id,
    waybillId:         row.waybill_id || null,
    waybillNumber:     row.waybill_number || null,
    goodsDescription:  row.goods_description,
    pickupLocation:    row.pickup_location,
    deliveryLocation:  row.delivery_location,
    status:            row.shipment_status,
    recipientName:     row.recipient_name || null,
    recipientPhone:    row.recipient_phone || null,
    shipmentValue:     Number(row.shipment_value || 0),
    handoverCount:     Number(row.handover_count || 0),
    addedAt:           row.added_at,
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
       COUNT(drl.id)::int AS leg_count,
       COALESCE(SUM(s.shipment_value), 0) AS total_value
     FROM dispatch_runs dr
     LEFT JOIN riders r ON r.id = dr.rider_id
     LEFT JOIN dispatch_run_legs drl ON drl.run_id = dr.id
     LEFT JOIN shipments s ON s.id = drl.shipment_id
     WHERE dr.user_id = $1
     GROUP BY dr.id, r.name
     ORDER BY dr.created_at DESC`,
    [userId]
  );
  return result.rows.map(mapRun);
}

async function getById(runId, userId) {
  const runResult = await query(
    `SELECT dr.*, r.name AS rider_name,
       COUNT(drl.id)::int AS leg_count,
       COALESCE(SUM(s.shipment_value), 0) AS total_value
     FROM dispatch_runs dr
     LEFT JOIN riders r ON r.id = dr.rider_id
     LEFT JOIN dispatch_run_legs drl ON drl.run_id = dr.id
     LEFT JOIN shipments s ON s.id = drl.shipment_id
     WHERE dr.id = $1 AND dr.user_id = $2
     GROUP BY dr.id, r.name`,
    [runId, userId]
  );
  const run = mapRun(runResult.rows[0]);
  if (!run) return null;

  const legsResult = await query(
    `SELECT
       drl.id AS leg_id, drl.shipment_id, drl.added_at,
       s.waybill_id, w.waybill_number,
       s.goods_description, s.pickup_location, s.delivery_location,
       s.status AS shipment_status,
       s.recipient_name, s.recipient_phone, s.shipment_value,
       (SELECT COUNT(*) FROM handover_events he WHERE he.shipment_id = s.id)::int AS handover_count
     FROM dispatch_run_legs drl
     JOIN shipments s ON s.id = drl.shipment_id
     LEFT JOIN waybills w ON w.id = s.waybill_id
     WHERE drl.run_id = $1
     ORDER BY drl.added_at`,
    [runId]
  );

  return { ...run, legs: legsResult.rows.map(mapLeg) };
}

async function addLeg(runId, shipmentId, userId) {
  // Verify run belongs to user and is still in loading state
  const run = await query(
    `SELECT id, status FROM dispatch_runs WHERE id = $1 AND user_id = $2`,
    [runId, userId]
  );
  if (!run.rows[0]) throw Object.assign(new Error("Run not found"), { status: 404 });
  if (run.rows[0].status !== "loading") {
    throw Object.assign(new Error("Cannot add legs to a run that has already departed"), { status: 409 });
  }
  // Verify shipment belongs to user
  const s = await query(`SELECT id FROM shipments WHERE id = $1 AND user_id = $2`, [shipmentId, userId]);
  if (!s.rows[0]) throw Object.assign(new Error("Shipment not found"), { status: 404 });

  await query(
    `INSERT INTO dispatch_run_legs (run_id, shipment_id) VALUES ($1, $2)`,
    [runId, shipmentId]
  );
}

async function removeLeg(runId, shipmentId, userId) {
  const run = await query(
    `SELECT id, status FROM dispatch_runs WHERE id = $1 AND user_id = $2`,
    [runId, userId]
  );
  if (!run.rows[0]) throw Object.assign(new Error("Run not found"), { status: 404 });
  if (run.rows[0].status !== "loading") {
    throw Object.assign(new Error("Cannot remove legs after departure"), { status: 409 });
  }
  await query(
    `DELETE FROM dispatch_run_legs WHERE run_id = $1 AND shipment_id = $2`,
    [runId, shipmentId]
  );
}

async function updateStatus(runId, userId, status) {
  const now = new Date();
  const extra = status === "in_transit"  ? ", departed_at = $3"
              : status === "completed"   ? ", completed_at = $3"
              : "";
  const params = extra ? [status, runId, now] : [status, runId];

  // Build query dynamically
  let sql = `UPDATE dispatch_runs SET status = $1, updated_at = NOW()${extra} WHERE id = $2 AND user_id = $${extra ? 4 : 3} RETURNING *`;
  if (extra) params.push(userId); else params.push(userId);
  // Simpler approach:
  if (status === "in_transit") {
    const r = await query(
      `UPDATE dispatch_runs SET status=$1, departed_at=NOW(), updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING *`,
      [status, runId, userId]
    );
    return mapRun(r.rows[0]);
  } else if (status === "completed") {
    const r = await query(
      `UPDATE dispatch_runs SET status=$1, completed_at=NOW(), updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING *`,
      [status, runId, userId]
    );
    return mapRun(r.rows[0]);
  } else {
    const r = await query(
      `UPDATE dispatch_runs SET status=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING *`,
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
