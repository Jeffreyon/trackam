/**
 * Optional local auth — like localAuthMiddleware but never 401s.
 * If a valid JWT is present, populates req.user; otherwise passes through
 * with req.user = undefined. Used so the OLI proxy can forward the user ID
 * for authenticated requests while still allowing public OLI routes through.
 */
const jwt    = require("jsonwebtoken");
const cookie = require("cookie");
const { warn } = require("../logger");

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "local_session";
const JWT_SECRET = process.env.JWT_SECRET;

function extractToken(req) {
  const rawCookieHeader = req.headers.cookie || "";
  if (rawCookieHeader) {
    const cookies = cookie.parse(rawCookieHeader);
    if (cookies[SESSION_COOKIE_NAME]) return cookies[SESSION_COOKIE_NAME];
  }
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.split("Bearer ")[1].trim();
  if (req.query?.token) return String(req.query.token);
  return null;
}

function localAuthOptional(req, _res, next) {
  const token = extractToken(req);
  if (token && JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        uid:            decoded.sub,
        email:          decoded.email,
        roles:          Array.isArray(decoded.roles) ? decoded.roles : [],
        email_verified: Boolean(decoded.email_verified),
      };
    } catch (err) {
      warn("local_auth_optional_ignored", { message: err.message });
    }
  }
  return next();
}

module.exports = localAuthOptional;
