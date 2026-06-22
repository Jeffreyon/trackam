const { query } = require("../../core/db/postgres");

function mapRun(row) {
  if (!row) return null;
  return {
    id:                    row.id,
    userId:                row.user_id,
    name:                  row.name || null,
    riderId:               row.rider_id || null,
    riderName:             row.rider_name || null,
    status:                row.status,
    notes:                 row.notes || null,
    distanceKm:            Number(row.distance_km || 0),
    riderFee:              Number(row.rider_fee || 0),
    fuelCost:              Number(row.fuel_cost || 0),
    totalCost:             Number(row.total_cost || 0),
    expectedDeliveryDate:  row.expected_delivery_date || null,
    delayFlag:             row.delay_flag || false,
    ghostingFlag:          row.ghosting_flag || false,
    departedAt:            row.departed_at || null,
    completedAt:           row.completed_at || null,
    legCount:              Number(row.leg_count || 0),
    totalValue:            Number(row.total_value || 0),
    originCity:            row.origin_city || null,
    destCity:              row.dest_city || null,
    createdAt:             row.created_at,
    updatedAt:             row.updated_at,
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

async function create({ userId, name, riderId, notes, distanceKm, riderFee, fuelCost, totalCost, expectedDeliveryDate, originCity, destCity }) {
  const result = await query(
    `INSERT INTO dispatch_runs
       (user_id, name, rider_id, notes, distance_km, rider_fee, fuel_cost, total_cost, expected_delivery_date, origin_city, dest_city)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [
      userId, name || null, riderId || null, notes || null,
      distanceKm || 0, riderFee || 0, fuelCost || 0, totalCost || 0,
      expectedDeliveryDate || null,
      originCity || null, destCity || null,
    ]
  );
  return getById(result.rows[0].id, userId);
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
    // After departure, only allow removal if the rider never took custody of this leg.
    // Once a handover event exists the PoH chain is live and removal is blocked.
    const heCheck = await query(
      `SELECT COUNT(*)::int AS cnt FROM handover_events WHERE shipment_id = $1`,
      [shipmentId]
    );
    if (Number(heCheck.rows[0].cnt) > 0) {
      throw Object.assign(
        new Error("Cannot remove a shipment that has already been handed over to a rider"),
        { status: 409 }
      );
    }
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
      `UPDATE dispatch_runs SET status=$1, departed_at=NOW(), last_status_update_at=NOW(), updated_at=NOW()
       WHERE id=$2 AND user_id=$3 RETURNING id`,
      [status, runId, userId]
    );
    if (!r.rows[0]) return null;
    await query(
      `UPDATE shipments SET status = 'in_transit', updated_at = NOW()
       WHERE run_id = $1 AND status NOT IN ('delivered','failed','ghosted')`,
      [runId]
    );
  } else if (status === "completed") {
    const r = await query(
      `UPDATE dispatch_runs SET status=$1, completed_at=NOW(), last_status_update_at=NOW(), updated_at=NOW()
       WHERE id=$2 AND user_id=$3 RETURNING id`,
      [status, runId, userId]
    );
    if (!r.rows[0]) return null;
    // A completed run means OUR rider/hub finished their leg — they handed
    // off to the next custodian. The shipment is NOT delivered until the
    // final receiver confirms (proof-of-delivery is a future feature; until
    // then we propagate via OLI Switch events).
    await query(
      `UPDATE shipments SET status = 'handed_over', updated_at = NOW()
       WHERE run_id = $1 AND status NOT IN ('delivered','failed','ghosted')`,
      [runId]
    );
  } else if (status === "cancelled") {
    const r = await query(
      `UPDATE dispatch_runs SET status=$1, last_status_update_at=NOW(), updated_at=NOW()
       WHERE id=$2 AND user_id=$3 RETURNING id`,
      [status, runId, userId]
    );
    if (!r.rows[0]) return null;
    // Detach shipments from the cancelled run, returning each to its prior
    // holding state: in_custody if it had been received from another operator
    // (waybill-backed), otherwise pending (originally claimed by us).
    await query(
      `UPDATE shipments
          SET status = CASE WHEN waybill_id IS NOT NULL THEN 'in_custody' ELSE 'pending' END,
              run_id = NULL,
              updated_at = NOW()
        WHERE run_id = $1 AND status NOT IN ('delivered','failed','ghosted','handed_over')`,
      [runId]
    );
  } else if (status === "with_carrier") {
    const r = await query(
      `UPDATE dispatch_runs SET status=$1, last_status_update_at=NOW(), updated_at=NOW()
       WHERE id=$2 AND user_id=$3 RETURNING id`,
      [status, runId, userId]
    );
    if (!r.rows[0]) return null;
  } else {
    const r = await query(
      `UPDATE dispatch_runs SET status=$1, last_status_update_at=NOW(), updated_at=NOW()
       WHERE id=$2 AND user_id=$3 RETURNING id`,
      [status, runId, userId]
    );
    if (!r.rows[0]) return null;
  }

  return getById(runId, userId);
}

// System-triggered (no userId): carrier received the booking → run is with the carrier
async function markWithCarrier(runId) {
  await query(
    `UPDATE dispatch_runs
     SET status = 'with_carrier', last_status_update_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'in_transit'`,
    [runId]
  );
}

// System-triggered (no userId): carrier delivered → run is complete
async function markCompleted(runId) {
  await query(
    `UPDATE dispatch_runs
     SET status = 'completed', completed_at = NOW(), last_status_update_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status IN ('in_transit', 'with_carrier')`,
    [runId]
  );
}

async function update(runId, userId, fields) {
  const sets = [];
  const vals = [];
  let idx = 1;

  if ("name" in fields)                 { sets.push(`name = $${idx++}`);                   vals.push(fields.name || null); }
  if ("riderId" in fields)              { sets.push(`rider_id = $${idx++}`);               vals.push(fields.riderId || null); }
  if ("notes" in fields)                { sets.push(`notes = $${idx++}`);                  vals.push(fields.notes || null); }
  if ("distanceKm" in fields)           { sets.push(`distance_km = $${idx++}`);            vals.push(fields.distanceKm || 0); }
  if ("riderFee" in fields)             { sets.push(`rider_fee = $${idx++}`);              vals.push(fields.riderFee || 0); }
  if ("fuelCost" in fields)             { sets.push(`fuel_cost = $${idx++}`);              vals.push(fields.fuelCost || 0); }
  if ("totalCost" in fields)            { sets.push(`total_cost = $${idx++}`);             vals.push(fields.totalCost || 0); }
  if ("expectedDeliveryDate" in fields) { sets.push(`expected_delivery_date = $${idx++}`); vals.push(fields.expectedDeliveryDate || null); }

  if (sets.length === 0) return getById(runId, userId);

  sets.push("updated_at = NOW()");
  vals.push(runId, userId);

  const r = await query(
    `UPDATE dispatch_runs SET ${sets.join(", ")}
     WHERE id = $${idx++} AND user_id = $${idx++} RETURNING id`,
    vals
  );
  if (!r.rows[0]) return null;
  return getById(runId, userId);
}

async function flagDelaysAndGhosting(userId, ghostThresholdHours) {
  await query(
    `UPDATE dispatch_runs
     SET delay_flag = TRUE, updated_at = NOW()
     WHERE user_id = $1
       AND status IN ('loading', 'in_transit')
       AND expected_delivery_date < NOW()::date
       AND delay_flag = FALSE`,
    [userId]
  );

  await query(
    `UPDATE dispatch_runs
     SET ghosting_flag = TRUE, updated_at = NOW()
     WHERE user_id = $1
       AND status = 'in_transit'
       AND last_status_update_at < NOW() - ($2 || ' hours')::interval
       AND ghosting_flag = FALSE`,
    [userId, ghostThresholdHours]
  );
}

module.exports = { create, listByUser, getById, addLeg, removeLeg, updateStatus, update, flagDelaysAndGhosting, markWithCarrier, markCompleted };
