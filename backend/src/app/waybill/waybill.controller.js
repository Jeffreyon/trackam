/**
 * Waybill local router — intercepts specific /api/waybill/* routes that need
 * local DB side-effects. All other routes fall through to the generic OLI
 * proxy mounted after this router in index.js.
 *
 * Intercepted routes:
 *   GET  /mine          — enrich OLI waybill list with local run data
 *   POST /claim         — forward to OLI, then mirror shipment into local DB
 *   POST /:id/join-leg  — forward to OLI, then mirror shipment into local DB
 *
 * Why mirror? The OLI switch creates shipments in its own database. Trackam's
 * ShipmentDetailPage and run-management features query the LOCAL shipments
 * table. Without a local record, the shipment appears "not found".
 */

const express           = require("express");
const http              = require("http");
const https             = require("https");
const { URL }           = require("url");
const { query }         = require("../../core/db/postgres");
const localAuthOptional = require("../../core/middlewares/localAuthOptional");
const asyncHandler      = require("../../core/middlewares/asyncHandler");

const router = express.Router();

const OLI_SWITCH_URL = process.env.OLI_SWITCH_URL || "http://localhost:5000";
const OLI_API_KEY    = process.env.OLI_API_KEY    || "";

// ── Internal OLI switch helpers ──────────────────────────────────────────────

function oliRequest(method, path, userId, body) {
  const base       = new URL(OLI_SWITCH_URL);
  const httpModule = base.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;

    const options = {
      hostname: base.hostname,
      port:     base.port || (base.protocol === "https:" ? 443 : 80),
      path,
      method,
      headers: {
        "accept":          "application/json",
        "content-type":    "application/json",
        "x-oli-api-key":   OLI_API_KEY,
        "x-oli-user-id":   userId || "",
        ...(bodyStr ? { "content-length": Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = httpModule.request(options, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch {
          reject(new Error("Non-JSON response from OLI switch"));
        }
      });
    });

    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const oliGet  = (path, userId)       => oliRequest("GET",  path, userId, null);
const oliPost = (path, userId, body) => oliRequest("POST", path, userId, body);

// ── Local DB helpers ─────────────────────────────────────────────────────────

/**
 * Upsert a lite_waybill record using data from the OLI switch waybill object.
 * Safe to call multiple times (ON CONFLICT DO NOTHING).
 */
async function upsertLiteWaybill(w) {
  await query(
    `INSERT INTO lite_waybills
       (id, waybill_number, sender_name, sender_phone,
        receiver_name, receiver_phone, receiver_address,
        goods_description, pickup_location, delivery_location,
        estimated_weight_kg, declared_value_ngn, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13,NOW()))
     ON CONFLICT (id) DO NOTHING`,
    [
      w.id,
      w.waybillNumber,
      w.senderName     || "—",
      w.senderPhone    || "—",
      w.receiverName   || "—",
      w.receiverPhone  || "—",
      w.deliveryLocation || "—",     // receiver_address — use delivery location
      w.goodsDescription,
      w.pickupLocation,
      w.deliveryLocation,
      w.estimatedWeightKg || null,
      w.shipmentValue     || null,
      w.createdAt         || null,
    ]
  );
}

/**
 * Upsert a local shipments record for a waybill leg.
 * Uses the OLI-generated shipmentId so frontend URLs stay consistent.
 */
async function upsertLocalShipment({ shipmentId, userId, waybillId, waybill }) {
  await query(
    `INSERT INTO shipments
       (id, user_id, waybill_id,
        goods_description, pickup_location, delivery_location,
        distance_km, shipment_value,
        recipient_name, recipient_phone,
        status, risk_score)
     VALUES ($1,$2,$3,$4,$5,$6, 0,$7,$8,$9, 'pending','low')
     ON CONFLICT (id) DO NOTHING`,
    [
      shipmentId,
      userId,
      waybillId,
      waybill.goodsDescription,
      waybill.pickupLocation,
      waybill.deliveryLocation,
      waybill.shipmentValue || 0,
      waybill.receiverName  || null,
      waybill.receiverPhone || null,
    ]
  );
}

// ── GET /mine — enrich with local run data ───────────────────────────────────

router.get("/mine", localAuthOptional, asyncHandler(async (req, res) => {
  const userId = req.user?.uid;

  let waybills;
  try {
    const { status, data } = await oliGet("/api/waybill/mine", userId);
    if (status !== 200) return res.status(status).json(data);
    waybills = data;
  } catch (err) {
    return res.status(502).json({ error: "OLI switch unavailable", detail: err.message });
  }

  if (!Array.isArray(waybills) || waybills.length === 0) {
    return res.json(waybills ?? []);
  }

  const shipmentIds = waybills.map((w) => w.shipmentId).filter(Boolean);
  if (shipmentIds.length === 0) return res.json(waybills);

  try {
    const result = await query(
      `SELECT s.id AS shipment_id, dr.id AS run_id, dr.name AS run_name, dr.status AS run_status
       FROM shipments s
       LEFT JOIN dispatch_runs dr ON dr.id = s.run_id
       WHERE s.id = ANY($1)`,
      [shipmentIds]
    );

    const runMap = {};
    for (const row of result.rows) {
      runMap[row.shipment_id] = {
        runId:     row.run_id     || null,
        runName:   row.run_name   || null,
        runStatus: row.run_status || null,
      };
    }

    return res.json(waybills.map((w) => {
      const run = w.shipmentId ? (runMap[w.shipmentId] ?? null) : null;
      return { ...w, runId: run?.runId ?? null, runName: run?.runName ?? null, runStatus: run?.runStatus ?? null };
    }));
  } catch {
    return res.json(waybills);
  }
}));

// ── POST /claim — claim a waybill, mirror into local DB ──────────────────────

router.post("/claim", localAuthOptional, asyncHandler(async (req, res) => {
  const userId = req.user?.uid;

  // Forward claim to OLI switch
  let oliData;
  try {
    const { status, data } = await oliPost("/api/waybill/claim", userId, req.body);
    if (status !== 200 && status !== 201) return res.status(status).json(data);
    oliData = data;
  } catch (err) {
    return res.status(502).json({ error: "OLI switch unavailable", detail: err.message });
  }

  // OLI claim response: { ...waybill, shipmentId }
  // The spread of the waybill gives us all fields we need for local mirrors.
  const { shipmentId, ...waybill } = oliData;

  if (shipmentId && userId && waybill.id) {
    try {
      await upsertLiteWaybill(waybill);
      await upsertLocalShipment({ shipmentId, userId, waybillId: waybill.id, waybill });
    } catch (dbErr) {
      // Non-fatal — log and continue. The user still gets their claimed waybill;
      // the shipment detail page will 404 until the mirror is retried.
      console.error("[waybill.controller] Failed to mirror claimed shipment locally:", dbErr.message);
    }
  }

  return res.status(201).json(oliData);
}));

// ── POST /:waybillId/join-leg — join a leg, mirror into local DB ─────────────

router.post("/:waybillId/join-leg", localAuthOptional, asyncHandler(async (req, res) => {
  const userId    = req.user?.uid;
  const waybillId = req.params.waybillId;

  // Forward join-leg to OLI switch
  let oliData;
  try {
    const { status, data } = await oliPost(`/api/waybill/${waybillId}/join-leg`, userId, req.body);
    if (status !== 200 && status !== 201) return res.status(status).json(data);
    oliData = data;
  } catch (err) {
    return res.status(502).json({ error: "OLI switch unavailable", detail: err.message });
  }

  // OLI join-leg response: { shipmentId, waybillId }
  const { shipmentId } = oliData;

  if (shipmentId && userId) {
    try {
      // Fetch waybill details so we can populate the local records
      const { status: wStatus, data: waybill } = await oliGet(`/api/waybill/${waybillId}`, userId);

      if (wStatus === 200 && waybill?.id) {
        await upsertLiteWaybill(waybill);
        await upsertLocalShipment({ shipmentId, userId, waybillId: waybill.id, waybill });
      }
    } catch (dbErr) {
      console.error("[waybill.controller] Failed to mirror joined shipment locally:", dbErr.message);
    }
  }

  return res.json(oliData);
}));

// ── POST /recover/:shipmentId — backfill a missing local shipment ─────────────
// Called by the frontend when GET /api/shipments/:id returns 404.
// Looks up the shipment via OLI switch /mine, creates local records, then
// the caller can retry GET /api/shipments/:id.

router.post("/recover/:shipmentId", localAuthOptional, asyncHandler(async (req, res) => {
  const userId     = req.user?.uid;
  const shipmentId = req.params.shipmentId;

  // Check if it already exists locally (race condition guard)
  const existing = await query(
    `SELECT id FROM shipments WHERE id = $1`,
    [shipmentId]
  );
  if (existing.rows[0]) return res.json({ recovered: false, reason: "already_exists" });

  // Fetch the operator's waybill list from OLI and find the matching shipment
  let waybills;
  try {
    const { status, data } = await oliGet("/api/waybill/mine", userId);
    if (status !== 200) return res.status(502).json({ error: "OLI switch unavailable" });
    waybills = data;
  } catch (err) {
    return res.status(502).json({ error: "OLI switch unavailable", detail: err.message });
  }

  const match = Array.isArray(waybills)
    ? waybills.find((w) => w.shipmentId === shipmentId)
    : null;

  if (!match) {
    return res.status(404).json({ error: "Shipment not found in OLI switch" });
  }

  // Fetch full waybill details so we have goods description etc.
  try {
    const { status: wStatus, data: waybill } = await oliGet(`/api/waybill/${match.id}`, userId);
    if (wStatus !== 200 || !waybill?.id) {
      return res.status(502).json({ error: "Could not fetch waybill details from OLI switch" });
    }

    await upsertLiteWaybill(waybill);
    await upsertLocalShipment({ shipmentId, userId, waybillId: waybill.id, waybill });

    return res.json({ recovered: true, shipmentId });
  } catch (err) {
    return res.status(500).json({ error: "Failed to mirror shipment locally", detail: err.message });
  }
}));

module.exports = router;
