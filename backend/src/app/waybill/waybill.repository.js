const { query } = require("../../core/db/postgres");
const crypto = require("crypto");

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    waybillNumber: row.waybill_number,
    claimToken: row.claim_token || null,
    claimedAt: row.claimed_at || null,
    claimedByUserId: row.claimed_by_user_id || null,
    senderName: row.sender_name,
    senderPhone: row.sender_phone,
    receiverName: row.receiver_name,
    receiverPhone: row.receiver_phone,
    receiverAddress: row.receiver_address,
    goodsDescription: row.goods_description,
    pickupLocation: row.pickup_location,
    deliveryLocation: row.delivery_location,
    estimatedWeightKg: row.estimated_weight_kg ? Number(row.estimated_weight_kg) : null,
    declaredValueNgn: row.declared_value_ngn ? Number(row.declared_value_ngn) : null,
    createdAt: row.created_at,
  };
}

function generateWaybillNumber() {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `WB-${dateStr}-${rand}`;
}

function generateClaimToken() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

async function create(data) {
  const waybillNumber = generateWaybillNumber();
  const claimToken = generateClaimToken();
  const result = await query(
    `INSERT INTO lite_waybills
       (waybill_number, claim_token, sender_name, sender_phone, receiver_name, receiver_phone,
        receiver_address, goods_description, pickup_location, delivery_location,
        estimated_weight_kg, declared_value_ngn)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      waybillNumber, claimToken,
      data.senderName, data.senderPhone,
      data.receiverName, data.receiverPhone, data.receiverAddress,
      data.goodsDescription, data.pickupLocation, data.deliveryLocation,
      data.estimatedWeightKg || null, data.declaredValueNgn || null,
    ]
  );
  return mapRow(result.rows[0]);
}

async function getById(id) {
  const result = await query(`SELECT * FROM lite_waybills WHERE id = $1`, [id]);
  return mapRow(result.rows[0]);
}

async function getByNumber(waybillNumber) {
  const result = await query(`SELECT * FROM lite_waybills WHERE waybill_number = $1`, [waybillNumber]);
  return mapRow(result.rows[0]);
}

async function claim(id, userId) {
  const result = await query(
    `UPDATE lite_waybills
     SET claimed_at = NOW(), claimed_by_user_id = $2
     WHERE id = $1 AND claimed_at IS NULL
     RETURNING *`,
    [id, userId]
  );
  return mapRow(result.rows[0]);
}

async function listByUser(userId) {
  const result = await query(
    `SELECT lw.*,
            COUNT(he.id)::int                                  AS handover_count,
            BOOL_OR(he.receiver_actor_type = 'ACTOR_RECEIVER') AS is_delivered,
            s.id                                               AS shipment_id,
            drl.run_id,
            dr.name                                            AS run_name,
            dr.status                                          AS run_status
     FROM lite_waybills lw
     LEFT JOIN handover_events he ON he.waybill_id = lw.id
     LEFT JOIN shipments s ON s.waybill_id = lw.id AND s.user_id = $1
     LEFT JOIN dispatch_run_legs drl ON drl.shipment_id = s.id
     LEFT JOIN dispatch_runs dr ON dr.id = drl.run_id
     WHERE lw.claimed_by_user_id = $1
     GROUP BY lw.id, s.id, drl.run_id, dr.name, dr.status
     ORDER BY lw.claimed_at DESC`,
    [userId]
  );
  return result.rows.map((row) => ({
    ...mapRow(row),
    handoverCount: row.handover_count ?? 0,
    isDelivered: row.is_delivered ?? false,
    shipmentId: row.shipment_id || null,
    runId: row.run_id || null,
    runName: row.run_name || null,
    runStatus: row.run_status || null,
  }));
}

// Returns all handover events for a waybill, with operator givers resolved to their display name.
async function getChain(waybillId) {
  const result = await query(
    `SELECT he.*,
            COALESCE(u.display_name, u.email) AS giver_user_name
     FROM handover_events he
     LEFT JOIN users u ON u.id = he.giver_user_id
     WHERE he.waybill_id = $1
     ORDER BY he.occurred_at ASC`,
    [waybillId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    shipmentId: row.shipment_id,
    waybillId: row.waybill_id,
    // giver_name set directly (driver portal) takes priority; fall back to users table lookup
    giverName: row.giver_name || row.giver_user_name || null,
    giverActorType: row.giver_actor_type,
    receiverName: row.receiver_name,
    receiverActorType: row.receiver_actor_type,
    proofHash: row.proof_hash,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    occurredAt: row.occurred_at,
  }));
}

module.exports = { create, getById, getByNumber, listByUser, claim, getChain };
