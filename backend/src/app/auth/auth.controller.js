const express = require("express");
const router = express.Router();
const asyncHandler = require("../../core/middlewares/asyncHandler");
const localAuthMiddleware = require("../../core/middlewares/localAuth");
const { attachAuthz } = require("../../core/middlewares/authz");
const AuthService = require("./auth.service");

const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME || "local_session";
const SESSION_COOKIE_MAX_AGE_DAYS = Number(
  process.env.SESSION_COOKIE_MAX_AGE_DAYS || "7"
);
const SESSION_COOKIE_MAX_AGE_MS =
  SESSION_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const SESSION_COOKIE_SECURE =
  (process.env.SESSION_COOKIE_SECURE || "false").toLowerCase() === "true";
const SESSION_COOKIE_DOMAIN = process.env.SESSION_COOKIE_DOMAIN || undefined;

// Cross-domain deployments (frontend ≠ backend origin) require
// sameSite: "none" + secure: true for cookies to be sent on AJAX requests.
// Local dev (same host, different ports) works with "lax".
const SESSION_COOKIE_SAMESITE = SESSION_COOKIE_SECURE ? "none" : "lax";

function buildCookieOptions(expiresIn) {
  const opts = {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: SESSION_COOKIE_SAMESITE,
    maxAge: expiresIn,
    path: "/",
  };
  if (SESSION_COOKIE_DOMAIN) {
    opts.domain = SESSION_COOKIE_DOMAIN;
  }
  return opts;
}

// POST /api/auth/signup
router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { email, password, profile } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "email and password are required" });
    }

    const result = await AuthService.signup({
      email,
      password,
      profile: profile || {},
    });

    // Create the long-lived session JWT (7 days)
    const { sessionCookie, expiresIn } =
      await AuthService.createSessionCookie(
        result.idToken,
        SESSION_COOKIE_MAX_AGE_MS
      );

    // Set cookie (same-domain fallback) + return token in body (primary)
    res.cookie(SESSION_COOKIE_NAME, sessionCookie, buildCookieOptions(expiresIn));
    res.status(201).json({ ...result, sessionToken: sessionCookie });
  })
);

// POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "email and password are required" });
    }

    const result = await AuthService.login({
      email,
      password,
      context: {
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
      },
    });

    const { sessionCookie, expiresIn } =
      await AuthService.createSessionCookie(
        result.idToken,
        SESSION_COOKIE_MAX_AGE_MS
      );

    res.cookie(SESSION_COOKIE_NAME, sessionCookie, buildCookieOptions(expiresIn));

    res.json({ ...result, sessionToken: sessionCookie });
  })
);

// GET /api/auth/me
router.get(
  "/me",
  localAuthMiddleware,
  attachAuthz,
  (req, res) => {
    const authz = req.authz;
    res.json({
      uid: authz.uid,
      user: authz.user,
      roles: authz.roles,
      permissions: authz.permissions,
      isAdmin: authz.isAdmin,
    });
  }
);

// POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    const result = await AuthService.forgotPassword({ email });
    res.json(result);
  })
);

// POST /api/auth/verify-email
// Resend verification email for an already authenticated user
router.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const { idToken } = req.body || {};

    if (!idToken) {
      return res.status(400).json({ message: "idToken is required" });
    }

    const result = await AuthService.resendVerification({ idToken });
    res.json(result);
  })
);

// POST /api/auth/logout
router.post(
  "/logout",
  localAuthMiddleware,
  asyncHandler(async (req, res) => {
    const uid = req.user && req.user.uid;
    if (!uid) {
      return res.status(401).json({ message: "Unauthenticated" });
    }

    await AuthService.logout(uid);

    res.clearCookie(SESSION_COOKIE_NAME, buildCookieOptions(0));

    res.json({ success: true });
  })
);

module.exports = router;
