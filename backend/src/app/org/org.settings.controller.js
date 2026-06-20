/**
 * Org-level logistics settings — admin-only.
 * Same key-value schema as per-user logistics_settings, but stored
 * under the well-known user_id '__org__'.
 */
const express = require("express");
const router = express.Router();
const localAuth = require("../../core/middlewares/localAuth");
const { attachAuthz, requireAdmin } = require("../../core/middlewares/authz");
const asyncHandler = require("../../core/middlewares/asyncHandler");
const { query } = require("../../core/db/postgres");
const oliAccountRepo = require("../oli/oli.account.repository");

async function pushBusinessIdentityToSwitch(businessName, businessCity) {
  try {
    const switchUrl = (process.env.OLI_SWITCH_URL || "http://localhost:5000").replace(/\/$/, "");
    const orgKey = await oliAccountRepo.getOrgApiKey();
    const apiKey = orgKey || process.env.OLI_API_KEY || "";
    if (!apiKey) return;
    await fetch(`${switchUrl}/api/operators/me/carrier-profile/business-identity`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-oli-api-key": apiKey },
      body: JSON.stringify({ businessName, businessCity }),
    });
  } catch {
    // Non-fatal — carrier profile may not exist yet
  }
}

router.use(localAuth, attachAuthz, requireAdmin);

const ORG_USER_ID = "__org__";

const ALLOWED_KEYS = [
  "fuel_price_per_litre",
  "fuel_efficiency_multiplier",
  "ghost_threshold_hours",
  "business_name",
  "business_city",
  "country",
  "logo_url",
  "contact_phone",
  "website_url",
  "sla_target_hours",
  "waybill_prefix",
];

const DEFAULTS = {
  fuel_price_per_litre: "950",
  fuel_efficiency_multiplier: "0.12",
  ghost_threshold_hours: "48",
  business_name: "",
  business_city: "",
  country: "ng",
  logo_url: "",
  contact_phone: "",
  website_url: "",
  sla_target_hours: "48",
  waybill_prefix: "",
};

async function ensureDefaults() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await query(
      `INSERT INTO logistics_settings (user_id, key, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, key) DO NOTHING`,
      [ORG_USER_ID, key, value]
    );
  }
}

// GET /api/org/settings
router.get("/", asyncHandler(async (_req, res) => {
  await ensureDefaults();
  const result = await query(
    `SELECT key, value FROM logistics_settings WHERE user_id = $1`,
    [ORG_USER_ID]
  );
  const settings = {};
  for (const row of result.rows) settings[row.key] = row.value;
  res.json(settings);
}));

// PATCH /api/org/settings
router.patch("/", asyncHandler(async (req, res) => {
  const updates = req.body;

  const invalid = Object.keys(updates).filter((k) => !ALLOWED_KEYS.includes(k));
  if (invalid.length) {
    return res.status(400).json({ error: `Unknown setting keys: ${invalid.join(", ")}` });
  }

  for (const [key, value] of Object.entries(updates)) {
    await query(
      `INSERT INTO logistics_settings (user_id, key, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [ORG_USER_ID, key, String(value)]
    );
  }

  const result = await query(
    `SELECT key, value FROM logistics_settings WHERE user_id = $1`,
    [ORG_USER_ID]
  );
  const settings = {};
  for (const row of result.rows) settings[row.key] = row.value;

  if (updates.business_name !== undefined || updates.business_city !== undefined) {
    pushBusinessIdentityToSwitch(
      updates.business_name ?? settings.business_name ?? null,
      updates.business_city ?? settings.business_city ?? null,
    );
  }

  res.json(settings);
}));

module.exports = router;
