const express  = require("express");
const crypto   = require("crypto");
const router   = express.Router();
const { query } = require("../../core/db/postgres");
const ssePool  = require("../../core/sse");
const oliAccountRepo = require("./oli.account.repository");
const runsRepo = require("../runs/runs.repository");

const OLI_API_KEY_ENV = process.env.OLI_API_KEY || "";

// Cache the verification key (single-tenant — one operator)
let _cachedKey = null;
let _cachedKeyExpiresAt = 0;

async function getVerificationKey() {
  if (OLI_API_KEY_ENV) return OLI_API_KEY_ENV;
  if (_cachedKey && _cachedKeyExpiresAt > Date.now()) return _cachedKey;
  const key = await oliAccountRepo.findDefaultApiKey();
  if (key) {
    _cachedKey = key;
    _cachedKeyExpiresAt = Date.now() + 60_000;
  }
  return key || "";
}

function verifySignature(rawBody, header, secret) {
  if (!header || !header.startsWith("sha256=") || !secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const received = header.slice("sha256=".length);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(received, "hex")
    );
  } catch {
    return false;
  }
}

// Mount with raw body parser so we can verify HMAC before JSON.parse
router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig  = req.headers["x-oli-signature"];
    const event = req.headers["x-oli-event"];

    const secret = await getVerificationKey();
    if (!verifySignature(req.body, sig, secret)) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ message: "Invalid JSON" });
    }

    // Acknowledge immediately — do async work after
    res.status(200).json({ received: true });

    handleEvent(event, payload).catch((err) => {
      console.error(`[oli.webhook] ${event} handler error:`, err.message);
    });
  }
);

async function handleEvent(event, payload) {
  switch (event) {
    case "handover.confirmed":
      return onHandoverConfirmed(payload);
    case "booking.accepted":
      return onBookingAccepted(payload);
    case "carrier.tracking_update":
      return onCarrierTrackingUpdate(payload);
    case "run_booking.received":
      return onRunBookingReceived(payload);
    case "run_booking.delivered":
      return onRunBookingDelivered(payload);
    default:
      break;
  }
}

async function onHandoverConfirmed(payload) {
  const { shipmentId, waybillId, receiverName, receiverActorType, proofHash, occurredAt } = payload;
  if (!shipmentId) return;

  try {
    // Look up the operator user who owns this shipment locally
    const result = await query(
      `SELECT s.user_id, s.waybill_id, s.status, s.run_id, lw.waybill_number
       FROM shipments s
       LEFT JOIN lite_waybills lw ON lw.id = s.waybill_id
       WHERE s.id = $1
       LIMIT 1`,
      [shipmentId]
    );
    const row = result.rows[0];
    if (!row?.user_id) return;

    // Update local shipment status to "handed_over" if still pending/in_transit
    if (["pending", "in_transit"].includes(row.status)) {
      await query(
        `UPDATE shipments SET status = 'handed_over', updated_at = NOW() WHERE id = $1`,
        [shipmentId]
      );

      // Add status log entry
      await query(
        `INSERT INTO status_log (shipment_id, new_status, note, changed_at)
         VALUES ($1, 'handed_over', $2, $3)
         ON CONFLICT DO NOTHING`,
        [
          shipmentId,
          `Custody transferred to ${receiverName} (${receiverActorType})`,
          occurredAt || new Date().toISOString(),
        ]
      ).catch(() => {}); // non-fatal

      // Item 4: when our rider hands over to a hub (ACTOR_HUB), check if all
      // shipments in the run are now at hub or beyond. If so, complete the run.
      if (receiverActorType === "ACTOR_HUB" && row.run_id) {
        const notYetHandedOver = await query(
          `SELECT COUNT(*)::int AS cnt
           FROM shipments
           WHERE run_id = $1
             AND status NOT IN ('handed_over', 'delivered', 'failed', 'ghosted')`,
          [row.run_id]
        );
        if (Number(notYetHandedOver.rows[0]?.cnt) === 0) {
          await runsRepo.markCompleted(row.run_id).catch(() => {});
        }
      }
    }

    // Push SSE event to operator's dashboard
    ssePool.publish(row.user_id, {
      type:              "waybill_handover",
      shipmentId,
      waybillId:         row.waybill_id || waybillId || null,
      waybillNumber:     row.waybill_number || null,
      receiverName,
      receiverActorType,
      proofHash,
      occurredAt,
      joinLegUrl:        null,
    });
  } catch (err) {
    console.error("[oli.webhook] onHandoverConfirmed error:", err.message);
  }
}

// Item 2: carrier received the booking — mark source run as with_carrier
async function onRunBookingReceived({ sourceRunId }) {
  if (!sourceRunId) return;
  try {
    await runsRepo.markWithCarrier(sourceRunId);
  } catch (err) {
    console.error("[oli.webhook] onRunBookingReceived error:", err.message);
  }
}

// Item 2: carrier delivered all shipments — mark source run as completed
async function onRunBookingDelivered({ sourceRunId }) {
  if (!sourceRunId) return;
  try {
    await runsRepo.markCompleted(sourceRunId);
  } catch (err) {
    console.error("[oli.webhook] onRunBookingDelivered error:", err.message);
  }
}

async function onCarrierTrackingUpdate(payload) {
  const { bookingId, carrier, trackingNumber, status, waybillId } = payload;
  try {
    const users = await query(`SELECT id FROM users WHERE id NOT LIKE '\\_\\_%\\_\\_' ESCAPE '\\'`);
    for (const { id: userId } of users.rows) {
      ssePool.publish(userId, {
        type: "carrier_tracking_update",
        bookingId,
        carrier,
        trackingNumber,
        status,
        waybillId: waybillId ?? null,
      });
    }
  } catch (err) {
    console.error("[oli.webhook] onCarrierTrackingUpdate SSE error:", err.message);
  }
}

async function onBookingAccepted(payload) {
  const { bookingId, waybillId, waybillNumber, bookerOperatorId, quotedRateKobo, goodsDescription, pickupLocation, deliveryLocation, acceptedAt } = payload;

  // Notify all connected users on this carrier instance via SSE
  // (carrier just accepted a booking — their team should know a shipment is coming)
  try {
    const users = await query(`SELECT id FROM users WHERE id NOT LIKE '\\_\\_%\\_\\_' ESCAPE '\\'`);
    for (const { id: userId } of users.rows) {
      ssePool.publish(userId, {
        type:             "booking_accepted",
        bookingId,
        waybillId,
        waybillNumber:    waybillNumber || null,
        bookerOperatorId,
        quotedRateKobo,
        goodsDescription: goodsDescription || null,
        pickupLocation:   pickupLocation   || null,
        deliveryLocation: deliveryLocation || null,
        acceptedAt,
      });
    }
  } catch (err) {
    console.error("[oli.webhook] onBookingAccepted SSE error:", err.message);
  }
}

module.exports = router;
