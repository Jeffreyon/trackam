/**
 * OLI Switch proxy — forwards /api/waybill, /api/handover, /api/custodian
 * to the private OLI Switch service, injecting the operator API key and
 * (when available) the authenticated user's ID.
 *
 * SSE streams (/stream/*) are forwarded with the same mechanism; Node's
 * http.request naturally supports streaming so no special handling is needed.
 */

const http  = require("http");
const https = require("https");
const { URL } = require("url");
const oliAccountRepo = require("./oli.account.repository");

const OLI_SWITCH_URL    = process.env.OLI_SWITCH_URL || "http://localhost:5000";
const OLI_API_KEY_ENV   = process.env.OLI_API_KEY    || "";

// Key resolution cache — single org key shared by all users
const _keyCache = new Map(); // cacheKey → { key, expiresAt }
const KEY_CACHE_TTL_MS = 60_000;

/**
 * Resolve the OLI API key for this request.
 *
 * Priority order:
 *   1. Org-level key (org_oli_config) — single-operator instance, all users share it
 *   2. Env var OLI_API_KEY — simple single-operator deployments
 *   3. Per-user key (oli_accounts) — open-source / legacy
 *   4. First active key in oli_accounts — unauthenticated fallback
 */
async function _resolveApiKey(userId) {
  // 1. Org-level key — shared by all users on this instance
  const orgCached = _keyCache.get("__org__");
  if (orgCached && orgCached.expiresAt > Date.now()) {
    if (orgCached.key) return orgCached.key;
  } else {
    try {
      const orgKey = await oliAccountRepo.getOrgApiKey();
      _keyCache.set("__org__", { key: orgKey, expiresAt: Date.now() + KEY_CACHE_TTL_MS });
      if (orgKey) return orgKey;
    } catch {
      // Fall through
    }
  }

  // 2. Env var
  if (OLI_API_KEY_ENV) return OLI_API_KEY_ENV;

  // 3. Per-user key (legacy / open-source)
  if (userId) {
    const cached = _keyCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.key;
    try {
      const account = await oliAccountRepo.findByUserId(userId);
      const key = account?.oli_api_key || "";
      _keyCache.set(userId, { key, expiresAt: Date.now() + KEY_CACHE_TTL_MS });
      if (key) return key;
    } catch {
      // Fall through
    }
  }

  // 4. First active key in oli_accounts (unauthenticated fallback)
  const defaultCached = _keyCache.get("__default__");
  if (defaultCached && defaultCached.expiresAt > Date.now()) return defaultCached.key;
  try {
    const key = await oliAccountRepo.findDefaultApiKey();
    if (key) _keyCache.set("__default__", { key, expiresAt: Date.now() + KEY_CACHE_TTL_MS });
    return key || "";
  } catch {
    return "";
  }
}

/**
 * Returns an Express middleware that proxies the request to the OLI switch.
 * Strips a `pathPrefix` from the front of the URL before forwarding so that
 *   /api/waybill/claim  →  /api/waybill/claim  (prefix already the same)
 * The switch mounts its own routes at /api/waybill, /api/handover, /api/custodian.
 */
function createOliProxy() {
  const switchBase = new URL(OLI_SWITCH_URL);
  const agent = switchBase.protocol === "https:" ? new https.Agent({ keepAlive: true }) : new http.Agent({ keepAlive: true });
  const httpModule = switchBase.protocol === "https:" ? https : http;

  return function oliProxy(req, res) {
    const targetUrl = new URL(req.originalUrl, OLI_SWITCH_URL);
    const userId = req.user?.uid || null;

    // Resolve API key then forward — async wrapper keeps the existing sync-style proxy logic
    _resolveApiKey(userId).then((apiKey) => {
      if (!apiKey) {
        console.warn(`[oli-proxy] No API key resolved — userId=${userId}, path=${req.originalUrl}`);
        return res.status(403).json({
          message: "OLI API key not configured. Go to Settings and paste your API key to connect to the OLI network.",
        });
      }
      _forward(req, res, targetUrl, apiKey, userId, httpModule, agent, switchBase);
    }).catch(() => {
      if (!res.headersSent) res.status(502).json({ error: "OLI switch unavailable" });
    });
  };
}

function _forward(req, res, targetUrl, apiKey, userId, httpModule, agent, switchBase) {
    const headers = { ...req.headers };
    // Remove hop-by-hop headers
    delete headers["host"];
    delete headers["connection"];
    delete headers["transfer-encoding"];

    // Inject operator credentials
    headers["x-oli-api-key"] = apiKey;
    headers["x-oli-user-id"] = userId || "";

    const options = {
      hostname: switchBase.hostname,
      port:     switchBase.port || (switchBase.protocol === "https:" ? 443 : 80),
      path:     targetUrl.pathname + targetUrl.search,
      method:   req.method,
      headers,
      agent,
    };

    const proxyReq = httpModule.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on("error", (err) => {
      if (!res.headersSent) {
        res.status(502).json({ error: "OLI switch unavailable", detail: err.message });
      } else {
        res.end();
      }
    });

    if (req.body !== undefined && Object.keys(req.body).length > 0) {
      // Body was already parsed by express.json() — re-serialize and send
      const bodyStr = JSON.stringify(req.body);
      proxyReq.setHeader("content-type", "application/json");
      proxyReq.setHeader("content-length", Buffer.byteLength(bodyStr));
      proxyReq.end(bodyStr);
    } else if (req.body !== undefined) {
      // express.json() parsed the body but it was empty ({}) — stream already consumed,
      // just end the request with no body so the switch doesn't wait forever
      proxyReq.setHeader("content-length", "0");
      proxyReq.end();
    } else {
      // Body parser did not run (multipart, file upload, etc.) — pipe the raw stream
      req.pipe(proxyReq, { end: true });
    }
}

module.exports = { createOliProxy };
