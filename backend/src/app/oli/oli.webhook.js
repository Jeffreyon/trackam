const express = require("express");
const crypto  = require("crypto");
const router  = express.Router();

const OLI_API_KEY = process.env.OLI_API_KEY || "";

function verifySignature(rawBody, header) {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = crypto
    .createHmac("sha256", OLI_API_KEY)
    .update(rawBody)
    .digest("hex");
  const received = header.slice("sha256=".length);
  // Constant-time comparison to prevent timing attacks
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
  (req, res) => {
    const sig  = req.headers["x-oli-signature"];
    const event = req.headers["x-oli-event"];

    if (!verifySignature(req.body, sig)) {
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

    handleEvent(event, payload).catch(() => {});
  }
);

async function handleEvent(event, payload) {
  switch (event) {
    case "handover.confirmed":
      return onHandoverConfirmed(payload);
    default:
      break;
  }
}

async function onHandoverConfirmed(payload) {
  const { shipmentId, waybillId, receiverName, receiverActorType, proofHash, occurredAt } = payload;

  // Nothing to do locally for now — the switch is the source of truth.
  // This is the extension point: trigger local notifications, update a
  // local cache table, fire Slack alerts, etc.
  //
  // Example: push an in-app notification to the operator user
  // await notificationsService.push({ ... });
}

module.exports = router;
