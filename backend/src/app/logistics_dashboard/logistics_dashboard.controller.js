const express = require("express");
const router = express.Router();
const localAuthMiddleware = require("../../core/middlewares/localAuth");
const asyncHandler = require("../../core/middlewares/asyncHandler");
const { query } = require("../../core/db/postgres");
const runsRepo = require("../runs/runs.repository");

async function getGhostThresholdHours(userId) {
  const r = await query(
    `SELECT value FROM logistics_settings WHERE user_id = $1 AND key = 'ghost_threshold_hours'`,
    [userId]
  );
  return parseInt(r.rows[0]?.value || "48", 10);
}

router.use(localAuthMiddleware);

// GET /api/logistics/dashboard/summary
// Today's shipment counts + this-month run-level aggregates
router.get("/summary", asyncHandler(async (req, res) => {
  const userId = req.user.uid;

  // Refresh run flags before reading
  const ghostThresholdHours = await getGhostThresholdHours(userId);
  await runsRepo.flagDelaysAndGhosting(userId, ghostThresholdHours);

  const [today, monthRuns, monthValue, alerts, exposure] = await Promise.all([
    // Shipment counts today still come from shipments — that's per-leg activity
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') AS pending,
         COUNT(*) FILTER (WHERE status = 'in_transit') AS in_transit,
         COUNT(*) FILTER (WHERE status = 'delivered') AS delivered
       FROM shipments
       WHERE user_id = $1 AND created_at::date = NOW()::date`,
      [userId]
    ),
    // Run-level monthly snapshot: total cost + ghost rate
    query(
      `SELECT
         COUNT(*) AS total_runs,
         COUNT(*) FILTER (WHERE ghosting_flag = TRUE) AS ghosted_count,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
         COALESCE(SUM(total_cost) FILTER (WHERE status != 'cancelled'), 0) AS total_cost_kobo,
         ROUND(
           COUNT(*) FILTER (WHERE ghosting_flag = TRUE)::numeric
           / NULLIF(COUNT(*), 0) * 100, 1
         ) AS ghost_rate
       FROM dispatch_runs
       WHERE user_id = $1
         AND date_trunc('month', created_at) = date_trunc('month', NOW())`,
      [userId]
    ),
    // Value lost on ghosted runs (sum the shipments attached to those runs)
    query(
      `SELECT
         COALESCE(SUM(s.shipment_value), 0) AS value_lost_kobo
       FROM shipments s
       JOIN dispatch_runs dr ON dr.id = s.run_id
       WHERE dr.user_id = $1
         AND dr.ghosting_flag = TRUE
         AND date_trunc('month', dr.created_at) = date_trunc('month', NOW())`,
      [userId]
    ),
    // Alerts: runs flagged as delayed or ghosting
    query(
      `SELECT COUNT(*) AS count
       FROM dispatch_runs
       WHERE user_id = $1
         AND (delay_flag = TRUE OR ghosting_flag = TRUE)
         AND status IN ('loading', 'in_transit')`,
      [userId]
    ),
    // Value at risk: shipments attached to active (non-completed/cancelled) runs + run costs
    query(
      `SELECT
         COALESCE((
           SELECT SUM(s.shipment_value)
           FROM shipments s
           JOIN dispatch_runs dr ON dr.id = s.run_id
           WHERE dr.user_id = $1 AND dr.status IN ('loading','in_transit')
         ), 0)
         + COALESCE((
           SELECT SUM(total_cost)
           FROM dispatch_runs
           WHERE user_id = $1 AND status IN ('loading','in_transit')
         ), 0) AS value_at_risk_kobo,
         COALESCE((
           SELECT SUM(s.shipment_value)
           FROM shipments s
           JOIN dispatch_runs dr ON dr.id = s.run_id
           WHERE dr.user_id = $1 AND dr.ghosting_flag = TRUE
         ), 0) AS all_time_value_lost_kobo`,
      [userId]
    ),
  ]);

  const t = today.rows[0];
  const m = monthRuns.rows[0];
  const mv = monthValue.rows[0];
  const e = exposure.rows[0];

  res.json({
    today: {
      pending: parseInt(t.pending, 10),
      inTransit: parseInt(t.in_transit, 10),
      delivered: parseInt(t.delivered, 10),
    },
    month: {
      totalShipments: parseInt(m.total_runs, 10),  // now = total runs
      deliveredCount: parseInt(m.completed_count, 10),
      ghostedCount: parseInt(m.ghosted_count, 10),
      ghostRate: parseFloat(m.ghost_rate || "0"),
      totalCostKobo: parseInt(m.total_cost_kobo, 10),
      valueLostKobo: parseInt(mv.value_lost_kobo, 10),
    },
    exposure: {
      valueAtRiskKobo: parseInt(e.value_at_risk_kobo, 10),
      allTimeValueLostKobo: parseInt(e.all_time_value_lost_kobo, 10),
    },
    alertCount: parseInt(alerts.rows[0].count, 10),
  });
}));

// GET /api/logistics/dashboard/alerts
// Runs flagged as delayed or ghosting
router.get("/alerts", asyncHandler(async (req, res) => {
  const userId = req.user.uid;

  const ghostThresholdHours = await getGhostThresholdHours(userId);
  await runsRepo.flagDelaysAndGhosting(userId, ghostThresholdHours);

  const result = await query(
    `SELECT dr.*, r.name AS rider_name,
            COALESCE((SELECT COUNT(*) FROM shipments s WHERE s.run_id = dr.id), 0)::int AS leg_count
     FROM dispatch_runs dr
     LEFT JOIN riders r ON r.id = dr.rider_id
     WHERE dr.user_id = $1
       AND (dr.delay_flag = TRUE OR dr.ghosting_flag = TRUE)
       AND dr.status IN ('loading', 'in_transit')
     ORDER BY dr.created_at DESC`,
    [userId]
  );

  res.json(result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    riderName: row.rider_name,
    status: row.status,
    legCount: row.leg_count,
    distanceKm: Number(row.distance_km || 0),
    totalCost: Number(row.total_cost || 0),
    delayFlag: row.delay_flag,
    ghostingFlag: row.ghosting_flag,
    expectedDeliveryDate: row.expected_delivery_date,
    lastStatusUpdateAt: row.last_status_update_at,
    createdAt: row.created_at,
  })));
}));

// GET /api/logistics/dashboard/costs
// Run-level cost breakdown by month and by rider
router.get("/costs", asyncHandler(async (req, res) => {
  const userId = req.user.uid;

  const [byMonth, byRider] = await Promise.all([
    query(
      `SELECT
         to_char(date_trunc('month', created_at), 'Mon YYYY') AS month,
         date_trunc('month', created_at) AS month_start,
         COUNT(*) AS run_count,
         COALESCE(SUM(total_cost), 0) AS total_cost_kobo,
         COALESCE(SUM(fuel_cost), 0) AS fuel_cost_kobo,
         COALESCE(SUM(rider_fee), 0) AS rider_fee_kobo
       FROM dispatch_runs
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '6 months'
       GROUP BY date_trunc('month', created_at)
       ORDER BY month_start DESC`,
      [userId]
    ),
    query(
      `SELECT
         r.id AS rider_id,
         r.name AS rider_name,
         COUNT(dr.id) AS run_count,
         COALESCE(SUM(dr.total_cost), 0) AS total_cost_kobo,
         ROUND(
           COUNT(dr.id) FILTER (WHERE dr.ghosting_flag = TRUE OR dr.status = 'cancelled')::numeric
           / NULLIF(COUNT(dr.id), 0) * 100, 1
         ) AS ghost_rate
       FROM riders r
       LEFT JOIN dispatch_runs dr ON dr.rider_id = r.id AND dr.user_id = $1
       WHERE r.user_id = $1 AND r.is_active = TRUE
       GROUP BY r.id, r.name
       ORDER BY total_cost_kobo DESC`,
      [userId]
    ),
  ]);

  res.json({
    byMonth: byMonth.rows.map((r) => ({
      month: r.month,
      shipmentCount: parseInt(r.run_count, 10),
      totalCostKobo: parseInt(r.total_cost_kobo, 10),
      fuelCostKobo: parseInt(r.fuel_cost_kobo, 10),
      riderFeeKobo: parseInt(r.rider_fee_kobo, 10),
    })),
    byRider: byRider.rows.map((r) => ({
      riderId: r.rider_id,
      riderName: r.rider_name,
      shipmentCount: parseInt(r.run_count, 10),
      totalCostKobo: parseInt(r.total_cost_kobo, 10),
      ghostRate: parseFloat(r.ghost_rate || "0"),
    })),
  });
}));

module.exports = router;
