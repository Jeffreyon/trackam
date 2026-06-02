const { query } = require("../../core/db/postgres");

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    waybillId: row.waybill_id || null,
    routeId: row.route_id,
    riderId: row.rider_id,
    riderName: row.rider_name || null,
    goodsDescription: row.goods_description,
    pickupLocation: row.pickup_location,
    deliveryLocation: row.delivery_location,
    distanceKm: row.distance_km,
    riderFee: Number(row.rider_fee),
    fuelCost: Number(row.fuel_cost),
    totalCost: Number(row.total_cost),
    status: row.status,
    riskScore: row.risk_score,
    riskScorePoints: row.risk_score_points,
    riskScoreReasons: row.risk_score_reasons || [],
    recipientName: row.recipient_name || null,
    recipientPhone: row.recipient_phone || null,
    recipientEmail: row.recipient_email || null,
    expectedDeliveryDate: row.expected_delivery_date,
    actualDeliveryDate: row.actual_delivery_date,
    lastStatusUpdateAt: row.last_status_update_at,
    delayFlag: row.delay_flag,
    ghostingFlag: row.ghosting_flag,
    shipmentValue: Number(row.shipment_value),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // Run context (when this shipment is part of a dispatch run)
    runId:        row.run_id || null,
    runName:      row.run_name || null,
    runStatus:    row.run_status || null,
    runTotalCost: row.run_total_cost != null ? Number(row.run_total_cost) : null,
    runLegCount:  row.run_leg_count  != null ? Number(row.run_leg_count) : null,

    // Waybill context (set when this shipment was claimed/joined from a waybill)
    waybill: row.waybill_number ? {
      number:         row.waybill_number,
      senderName:     row.sender_name     || null,
      senderPhone:    row.sender_phone    || null,
      receiverName:   row.receiver_name   || null,
      receiverPhone:  row.receiver_phone  || null,
      goodsDescription: row.lite_goods_description || null,
      pickupLocation:   row.lite_pickup_location   || null,
      deliveryLocation: row.lite_delivery_location || null,
      createdAt:      row.waybill_created_at || null,
    } : null,
  };
}

// Shared SELECT + JOIN clauses so list() and getById() return identical column shapes
// (so mapRow stays honest — partial waybill/run objects across endpoints would be a bug).
const SHIPMENT_SELECT_SQL = `
  SELECT s.*,
         r.name           AS rider_name,
         dr.id            AS run_id,
         dr.name          AS run_name,
         dr.status        AS run_status,
         dr.total_cost    AS run_total_cost,
         (SELECT COUNT(*)::int FROM shipments WHERE run_id = dr.id) AS run_leg_count,
         lw.waybill_number,
         lw.sender_name,
         lw.sender_phone,
         lw.receiver_name,
         lw.receiver_phone,
         lw.goods_description AS lite_goods_description,
         lw.pickup_location   AS lite_pickup_location,
         lw.delivery_location AS lite_delivery_location,
         lw.created_at        AS waybill_created_at
  FROM shipments s
  LEFT JOIN riders r         ON r.id = s.rider_id
  LEFT JOIN dispatch_runs dr ON dr.id = s.run_id
  LEFT JOIN lite_waybills lw ON lw.id = s.waybill_id
`;

async function list(userId, { status, riderId, limit = 50, offset = 0 } = {}) {
  const conditions = ["s.user_id = $1"];
  const values = [userId];
  let i = 2;

  if (status) { conditions.push(`s.status = $${i++}`); values.push(status); }
  if (riderId) { conditions.push(`s.rider_id = $${i++}`); values.push(riderId); }

  values.push(limit, offset);
  const result = await query(
    `${SHIPMENT_SELECT_SQL}
     WHERE ${conditions.join(" AND ")}
     ORDER BY s.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    values
  );
  return result.rows.map(mapRow);
}

async function getById(id, userId) {
  const result = await query(
    `${SHIPMENT_SELECT_SQL} WHERE s.id = $1 AND s.user_id = $2`,
    [id, userId]
  );
  return mapRow(result.rows[0]);
}

async function create(data) {
  const result = await query(
    `INSERT INTO shipments
       (user_id, route_id, rider_id, goods_description, pickup_location, delivery_location,
        distance_km, rider_fee, fuel_cost, total_cost, shipment_value,
        risk_score, risk_score_points, risk_score_reasons,
        expected_delivery_date, notes, recipient_name, recipient_phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      data.userId, data.routeId || null, data.riderId || null,
      data.goodsDescription, data.pickupLocation, data.deliveryLocation,
      data.distanceKm, data.riderFee, data.fuelCost, data.totalCost, data.shipmentValue || 0,
      data.riskScore, data.riskScorePoints, data.riskScoreReasons,
      data.expectedDeliveryDate || null, data.notes || null,
      data.recipientName || null, data.recipientPhone || null,
    ]
  );
  return mapRow(result.rows[0]);
}

async function updateStatus(id, userId, { newStatus, note }) {
  const current = await getById(id, userId);
  if (!current) return null;

  await query(
    `INSERT INTO shipment_status_log (shipment_id, old_status, new_status, note)
     VALUES ($1, $2, $3, $4)`,
    [id, current.status, newStatus, note || null]
  );

  const result = await query(
    `UPDATE shipments
     SET status = $1,
         last_status_update_at = NOW(),
         delay_flag = CASE WHEN $1 IN ('delivered','failed','ghosted') THEN FALSE ELSE delay_flag END,
         ghosting_flag = CASE WHEN $1 = 'ghosted' THEN TRUE WHEN $1 IN ('delivered','failed','in_transit') THEN FALSE ELSE ghosting_flag END,
         actual_delivery_date = CASE WHEN $1 IN ('delivered','failed','ghosted') THEN NOW()::date WHEN $1 = 'in_transit' THEN NULL ELSE actual_delivery_date END,
         updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [newStatus, id, userId]
  );
  return mapRow(result.rows[0]);
}

async function getStatusLog(shipmentId, userId) {
  const shipment = await getById(shipmentId, userId);
  if (!shipment) return null;

  const result = await query(
    `SELECT * FROM shipment_status_log WHERE shipment_id = $1 ORDER BY changed_at ASC`,
    [shipmentId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    shipmentId: row.shipment_id,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    note: row.note,
    changedAt: row.changed_at,
  }));
}

async function flagDelaysAndGhosting(userId, ghostThresholdHours) {
  await query(
    `UPDATE shipments
     SET delay_flag = TRUE, updated_at = NOW()
     WHERE user_id = $1
       AND status IN ('pending', 'in_transit')
       AND expected_delivery_date < NOW()::date
       AND delay_flag = FALSE`,
    [userId]
  );

  await query(
    `UPDATE shipments
     SET ghosting_flag = TRUE, updated_at = NOW()
     WHERE user_id = $1
       AND status = 'in_transit'
       AND last_status_update_at < NOW() - ($2 || ' hours')::interval
       AND ghosting_flag = FALSE`,
    [userId, ghostThresholdHours]
  );
}

// Service-level status update — used when there's no operator user_id (custodian handovers).
// The caller is responsible for authorization (token validation gates this path).
async function systemUpdateStatus(id, { newStatus, note }) {
  const current = await query(`SELECT status FROM shipments WHERE id = $1`, [id]);
  const oldStatus = current.rows[0]?.status || null;

  await query(
    `INSERT INTO shipment_status_log (shipment_id, old_status, new_status, note)
     VALUES ($1, $2, $3, $4)`,
    [id, oldStatus, newStatus, note || null]
  );

  await query(
    `UPDATE shipments
     SET status = $1, last_status_update_at = NOW(), updated_at = NOW()
     WHERE id = $2`,
    [newStatus, id]
  );
}

// When final delivery is confirmed, mark every leg of the same waybill as delivered.
async function deliverAllByWaybill(waybillId) {
  await query(
    `UPDATE shipments
       SET status = 'delivered',
           last_status_update_at = NOW(),
           actual_delivery_date = NOW()::date,
           updated_at = NOW()
     WHERE waybill_id = $1
       AND status NOT IN ('delivered', 'failed')`,
    [waybillId]
  );
}

module.exports = { list, getById, create, updateStatus, systemUpdateStatus, getStatusLog, flagDelaysAndGhosting, deliverAllByWaybill };
