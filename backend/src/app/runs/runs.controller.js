const express = require("express");
const router = express.Router();
const localAuthMiddleware = require("../../core/middlewares/localAuth");
const asyncHandler = require("../../core/middlewares/asyncHandler");
const RunsService = require("./runs.service");

router.use(localAuthMiddleware);

// List all runs for the operator
router.get("/", asyncHandler(async (req, res) => {
  res.json(await RunsService.listRuns(req.user.uid));
}));

// Create a new dispatch run
router.post("/", asyncHandler(async (req, res) => {
  res.status(201).json(await RunsService.createRun(req.user.uid, req.body));
}));

// Get run detail with all legs
router.get("/:id", asyncHandler(async (req, res) => {
  res.json(await RunsService.getRunDetail(req.user.uid, req.params.id));
}));

// Update run metadata (name, rider, notes)
router.patch("/:id", asyncHandler(async (req, res) => {
  res.json(await RunsService.updateRun(req.user.uid, req.params.id, req.body));
}));

// Update run status (loading → in_transit → completed)
router.patch("/:id/status", asyncHandler(async (req, res) => {
  res.json(await RunsService.updateStatus(req.user.uid, req.params.id, req.body));
}));

// Add a shipment leg to a run
router.post("/:id/legs", asyncHandler(async (req, res) => {
  res.status(201).json(await RunsService.addLeg(req.user.uid, req.params.id, req.body));
}));

// Remove a shipment leg from a run
router.delete("/:id/legs/:shipmentId", asyncHandler(async (req, res) => {
  res.json(await RunsService.removeLeg(req.user.uid, req.params.id, req.params.shipmentId));
}));

module.exports = router;
