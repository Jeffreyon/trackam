const express = require("express");
const router = express.Router();
const asyncHandler = require("../../core/middlewares/asyncHandler");
const localAuth = require("../../core/middlewares/localAuth");
const repo = require("./oli.account.repository");

// GET /api/oli-account — return current OLI provisioning status for the logged-in user
router.get("/", localAuth, asyncHandler(async (req, res) => {
  const account = await repo.findByUserId(req.user.uid);
  if (!account) {
    return res.json({ status: "not_provisioned" });
  }
  res.json({
    status: account.oli_status,
    hasApiKey: Boolean(account.oli_api_key),
  });
}));

// POST /api/oli-account/api-key — operator enters the API key they received by email
router.post("/api-key", localAuth, asyncHandler(async (req, res) => {
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

module.exports = router;
