const express = require("express");
const router = express.Router();
const localAuthMiddleware = require("../../core/middlewares/localAuth");
const asyncHandler = require("../../core/middlewares/asyncHandler");
const {
  attachAuthz,
  requireAdmin,
  requireSelfOrAdmin,
} = require("../../core/middlewares/authz");
const UsersService = require("./users.service");

// Protect all user routes and attach RBAC context
router.use(localAuthMiddleware, attachAuthz);

// List users (admin-only)
router.get(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await UsersService.listUsers();
    res.json(users);
  })
);

// ── Verification queue (admin-only) ───────────────────────────────────────
// MUST come before /:id so 'pending-verification' isn't matched as an id.

router.get(
  "/pending-verification",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await UsersService.listPendingVerification();
    res.json(users);
  })
);

router.post(
  "/:id/verify",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await UsersService.verifyStaff(req.params.id, req.user.uid);
    res.json(user);
  })
);

router.post(
  "/:id/reject",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await UsersService.rejectStaff(
      req.params.id, req.user.uid, req.body?.rejectionReason
    );
    res.json(user);
  })
);

// ── Staff profile (self) — upload phone + ID for verification ─────────────

router.patch(
  "/:id/staff-profile",
  requireSelfOrAdmin("id"),
  asyncHandler(async (req, res) => {
    const user = await UsersService.updateStaffProfile(req.params.id, req.body || {});
    res.json(user);
  })
);

// Get a single user by id (admin or self).
// includePhoto=1 returns the base64 ID photo for the admin review modal.
router.get(
  "/:id",
  requireSelfOrAdmin("id"),
  asyncHandler(async (req, res) => {
    const includePhoto = req.query.includePhoto === "1" || req.query.includePhoto === "true";
    const user = await UsersService.getUser(req.params.id, { includePhoto });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  })
);

// Upsert user document (admin or self)
router.put(
  "/:id",
  requireSelfOrAdmin("id"),
  asyncHandler(async (req, res) => {
    const user = await UsersService.upsertUser(req.params.id, req.body || {});
    res.json(user);
  })
);

// PATCH /:id/roles — update a user's roles (admin-only)
router.patch(
  "/:id/roles",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { roles } = req.body;
    if (!Array.isArray(roles)) {
      return res.status(400).json({ message: "roles must be an array" });
    }
    const user = await UsersService.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const updated = await UsersService.upsertUser(req.params.id, { ...user, roles });
    res.json(updated);
  })
);

// PATCH /:id/disable — toggle a user's disabled state (admin-only)
router.patch(
  "/:id/disable",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { disabled } = req.body;
    const user = await UsersService.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Store disabled state in preferences
    const prefs = { ...(user.preferences || {}), disabled: Boolean(disabled) };
    const updated = await UsersService.upsertUser(req.params.id, { ...user, preferences: prefs });
    res.json(updated);
  })
);

module.exports = router;
