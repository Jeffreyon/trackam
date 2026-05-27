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

const OLI_SWITCH_URL = process.env.OLI_SWITCH_URL || "http://localhost:5000";
const OLI_API_KEY    = process.env.OLI_API_KEY    || "";

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

    const headers = { ...req.headers };
    // Remove hop-by-hop headers
    delete headers["host"];
    delete headers["connection"];
    delete headers["transfer-encoding"];

    // Inject operator credentials
    headers["x-oli-api-key"] = OLI_API_KEY;
    headers["x-oli-user-id"] = req.user?.uid || "";

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

    if (req.body && Object.keys(req.body).length > 0) {
      // Body was already parsed by express.json() — re-serialize and send
      const bodyStr = JSON.stringify(req.body);
      proxyReq.setHeader("content-type", "application/json");
      proxyReq.setHeader("content-length", Buffer.byteLength(bodyStr));
      proxyReq.end(bodyStr);
    } else {
      // Pipe raw stream (for multipart, or already-empty bodies)
      req.pipe(proxyReq, { end: true });
    }
  };
}

module.exports = { createOliProxy };
