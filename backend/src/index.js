const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const asyncHandler = require("./core/middlewares/asyncHandler");
const rateLimiter = require("./core/middlewares/rateLimiter");
const errorHandler = require("./core/middlewares/errorHandler");
const { query } = require("./core/db/postgres");
const { ensureStorageDir, storageDirectory } = require("./core/storage/localStorage");

const app = express();
const LOCAL_HOST_ALIASES = new Set(["localhost", "127.0.0.1"]);

function normalizeOrigin(origin) {
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.hostname}:${url.port || (url.protocol === "https:" ? "443" : "80")}`;
  } catch {
    return null;
  }
}

function buildAllowedOrigins(value) {
  const configured = String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowed = new Set();

  for (const origin of configured) {
    const normalized = normalizeOrigin(origin);
    if (!normalized) continue;
    allowed.add(normalized);

    try {
      const url = new URL(origin);
      if (LOCAL_HOST_ALIASES.has(url.hostname)) {
        for (const alias of LOCAL_HOST_ALIASES) {
          allowed.add(`${url.protocol}//${alias}:${url.port || (url.protocol === "https:" ? "443" : "80")}`);
        }
      }
    } catch {
      // Ignore malformed origins here and let the normalized set drive decisions.
    }
  }

  return allowed;
}

const allowedOrigins = buildAllowedOrigins(process.env.FRONTEND_URL);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.size === 0) {
        return callback(null, true);
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (normalizedOrigin && allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(morgan("dev"));

// Must be mounted before express.json() — needs raw body for HMAC verification
app.use("/api/oli/webhook", require("./app/oli/oli.webhook"));

app.use(express.json());

ensureStorageDir();
app.use("/storage", express.static(storageDirectory));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get(
  "/ready",
  asyncHandler(async (req, res) => {
    await query("SELECT 1");
    res.json({ status: "ready" });
  })
);

app.use("/api/users", rateLimiter, require("./app/users/users.controller"));
app.use("/api/auth", require("./app/auth/auth.controller"));
app.use(
  "/api/notifications",
  rateLimiter,
  require("./app/notifications/notifications.controller")
);
app.use("/api/events", rateLimiter, require("./app/events/events.controller"));
app.use("/api/roles", require("./app/roles/roles.controller"));
app.use("/api/settings", require("./app/settings/settings.controller"));
app.use("/api/devices", rateLimiter, require("./app/devices/devices.controller"));
app.use("/api/sessions", rateLimiter, require("./app/sessions/sessions.controller"));

// Trackam logistics domain
app.use("/api/riders", rateLimiter, require("./app/riders/riders.controller"));
app.use("/api/routes", rateLimiter, require("./app/routes/routes.controller"));
app.use("/api/shipments", rateLimiter, require("./app/shipments/shipments.controller"));
app.use("/api/logistics/dashboard", rateLimiter, require("./app/logistics_dashboard/logistics_dashboard.controller"));
app.use("/api/logistics/settings", rateLimiter, require("./app/logistics_settings/logistics_settings.controller"));

// OLI account provisioning
app.use("/api/oli-account", rateLimiter, require("./app/oli/oli.account.controller"));

// OLI Switch proxy — forwards waybill / handover / custodian to the private switch
const { createOliProxy } = require("./app/oli/oli.proxy");
const localAuthOptional  = require("./core/middlewares/localAuthOptional");
const oliProxy = createOliProxy();
// Local waybill router intercepts /mine for run enrichment; all others fall through to proxy
app.use("/api/waybill",   rateLimiter, require("./app/waybill/waybill.controller"));
app.use("/api/waybill",   rateLimiter, localAuthOptional, oliProxy);
app.use("/api/handover",  rateLimiter, localAuthOptional, oliProxy);
app.use("/api/custodian", rateLimiter, oliProxy);
app.use("/api/wallet",   rateLimiter, localAuthOptional, oliProxy);
// Dispatch runs — operator vehicle trip grouping
app.use("/api/runs", rateLimiter, require("./app/runs/runs.controller"));

app.use("/", (req, res) => {
  res.send(
    "Trackam backend API. Routes: /api/riders, /api/routes, /api/shipments, /api/logistics/dashboard, /api/logistics/settings"
  );
});

app.use(errorHandler);

module.exports = app;
