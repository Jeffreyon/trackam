const { query } = require("../../core/db/postgres");

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
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
    expectedDeliveryDate: row.expected_delivery_date,
    actualDeliveryDate: row.actual_delivery_date,
    lastStatusUpdateAt: row.last_status_update_at,
    delayFlag: row.delay_flag,
    ghostingFlag: row.ghosting_flag,
    shipmentValue: Number(row.shipment_value),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function list(userId, { status, riderId, limit = 50, offset = 0 } = {}) {
  const conditions = ["s.user_id = $1"];
  const values = [userId];
  let i = 2;

  if (status) { conditions.push(`s.status = $${i++}`); values.push(status); }
  if (riderId) { conditions.push(`s.rider_id = $${i++}`); values.push(riderId); }

  values.push(limit, offset);
  const result = await query(
    `SELECT s.*, r.name AS rider_name
     FROM shipments s
     LEFT JOIN riders r ON r.id = s.rider_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY s.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    values
  );
  return result.rows.map(mapRow);
}

async function getById(id, userId) {
  const result = await query(
    `SELECT s.*, r.name AS rider_name
     FROM shipments s
     LEFT JOIN riders r ON r.id = s.rider_id
     WHERE s.id = $1 AND s.user_id = $2`,
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
         delay_flag = CASE WHEN $1 IN ('delivered','failed','ghosted','recovered') THEN FALSE ELSE delay_flag END,
         ghosting_flag = CASE WHEN $1 = 'ghosted' THEN TRUE WHEN $1 IN ('delivered','failed','recovered') THEN FALSE ELSE ghosting_flag END,
         actual_delivery_date = CASE WHEN $1 IN ('delivered','failed','ghosted') THEN NOW()::date ELSE actual_delivery_date END,
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

module.exports = { list, getById, create, updateStatus, getStatusLog, flagDelaysAndGhosting };
