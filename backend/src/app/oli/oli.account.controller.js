const express = require("express");
const router = express.Router();
const asyncHandler = require("../../core/middlewares/asyncHandler");
const localAuth = require("../../core/middlewares/localAuth");
const { attachAuthz, requireAdmin } = require("../../core/middlewares/authz");
const repo = require("./oli.account.repository");

// ── Org-level OLI config (super_admin / admin) ─────────────────────────────

// GET /api/oli-account/org — return org-level OLI provisioning status
router.get("/org", localAuth, attachAuthz, requireAdmin, asyncHandler(async (req, res) => {
  const config = await repo.getOrgConfig();
  if (!config) {
    return res.json({ status: "not_provisioned", hasApiKey: false });
  }
  res.json({
    status: config.oli_status,
    hasApiKey: Boolean(config.oli_api_key),
    operatorId: config.oli_operator_id || null,
  });
}));

// POST /api/oli-account/org/api-key — founder enters the org-level API key
router.post("/org/api-key", localAuth, attachAuthz, requireAdmin, asyncHandler(async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return res.status(400).json({ message: "A valid API key is required" });
  }
  await repo.saveOrgApiKey(apiKey.trim());
  res.json({ status: "active", hasApiKey: true });
}));

// POST /api/oli-account/org/api-key/rotate — clear org key (re-enter pending)
router.post("/org/api-key/rotate", localAuth, attachAuthz, requireAdmin, asyncHandler(async (req, res) => {
  const result = await repo.clearOrgApiKey();
  if (!result) {
    return res.status(404).json({ message: "Org OLI config not found" });
  }
  res.json({ status: "pending", hasApiKey: false });
}));

// ── Per-user OLI account (legacy / open-source) ────────────────────────────

// GET /api/oli-account — return current OLI provisioning status for the logged-in user
router.get("/", localAuth, asyncHandler(async (req, res) => {
  // In commercial mode, return org-level status instead of per-user
  const orgConfig = await repo.getOrgConfig();
  if (orgConfig?.oli_api_key) {
    return res.json({
      status: orgConfig.oli_status,
      hasApiKey: true,
      orgManaged: true, // signals to the frontend that this is org-level
    });
  }

  // Fall back to per-user account
  const account = await repo.findByUserId(req.user.uid);
  if (!account) {
    return res.json({ status: "not_provisioned" });
  }
  res.json({
    status: account.oli_status,
    hasApiKey: Boolean(account.oli_api_key),
    orgManaged: false,
  });
}));

// POST /api/oli-account/api-key — operator enters the API key they received by email
// In commercial mode this is blocked — only the super_admin sets the org key
router.post("/api-key", localAuth, asyncHandler(async (req, res) => {
  const orgConfig = await repo.getOrgConfig();
  if (orgConfig?.oli_api_key) {
    return res.status(403).json({
      message: "OLI API key is managed at the org level. Contact your admin.",
      orgManaged: true,
    });
  }

  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return res.status(400).json({ message: "A valid API key is required" });
  }
  const account = await repo.saveApiKey(req.user.uid, apiKey.trim());
  if (!account) {
    return res.status(404).json({ message: "OLI account not found — please contact support" });
  }
  res.json({ status: "active", hasApiKey: true });
}));

// POST /api/oli-account/rotate-switch-key — rotate the key on the switch and save the new one locally
router.post("/rotate-switch-key", localAuth, asyncHandler(async (req, res) => {
  // Resolve current key: org-level takes priority (same priority as the proxy)
  const orgConfig = await repo.getOrgConfig();
  const currentKey = orgConfig?.oli_api_key || (await repo.findByUserId(req.user.uid))?.oli_api_key;
  if (!currentKey) {
    return res.status(400).json({ message: "No OLI API key configured. Add your API key in settings first." });
  }

  const switchUrl = (process.env.OLI_SWITCH_URL || "http://localhost:5000").replace(/\/$/, "");
  const switchRes = await fetch(`${switchUrl}/api/operators/me/rotate-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-oli-api-key": currentKey,
    },
    body: "{}",
  });

  if (!switchRes.ok) {
    const data = await switchRes.json().catch(() => ({}));
    return res.status(switchRes.status).json({ message: data?.message || "Failed to rotate key on OLI network" });
  }

  const { apiKey: newKey } = await switchRes.json();

  // Save to both stores to keep them in sync
  await repo.saveApiKey(req.user.uid, newKey);
  if (orgConfig) await repo.saveOrgApiKey(newKey);

  res.json({ status: "active", hasApiKey: true, rotated: true });
}));

// POST /api/oli-account/api-key/rotate — clear the stored key
router.post("/api-key/rotate", localAuth, asyncHandler(async (req, res) => {
  const orgConfig = await repo.getOrgConfig();
  if (orgConfig?.oli_api_key) {
    return res.status(403).json({
      message: "OLI API key is managed at the org level. Contact your admin.",
      orgManaged: true,
    });
  }

  const account = await repo.clearApiKey(req.user.uid);
  if (!account) {
    return res.status(404).json({ message: "OLI account not found" });
  }
  res.json({ status: "pending", hasApiKey: false });
}));

module.exports = router;
