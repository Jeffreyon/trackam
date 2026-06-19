const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const https = require("https");
const http = require("http");
const { v4: uuidv4 } = require("uuid");
const UsersService = require("../users/users.service");
const UsersRepository = require("../users/users.repository");
const SessionsRepository = require("../sessions/sessions.repository");
const DevicesRepository = require("../devices/devices.repository");
const EventsRepository = require("../events/events.repository");
const oliAccountRepo = require("../oli/oli.account.repository");

const OLI_SWITCH_URL = process.env.OLI_SWITCH_URL || "";
const TRACKAM_FRONTEND_URL = process.env.FRONTEND_URL || "";
const TRACKAM_BACKEND_URL  = process.env.BACKEND_URL  || "";

// Fire-and-forget — never blocks or fails the Trackam signup.
// In commercial mode (org_oli_config has an active key) we skip per-user
// provisioning — the founder already registered the org on OLI Switch.
async function _provisionOliAccount(userId, { email, displayName }) {
  if (!OLI_SWITCH_URL) return;

  // Skip if this instance is org-managed (commercial model)
  try {
    const orgKey = await oliAccountRepo.getOrgApiKey();
    if (orgKey) return; // org already registered — no per-user provisioning
  } catch {
    // org_oli_config table may not exist yet (pre-migration) — fall through
  }

  try {
    const webhookUrl = TRACKAM_BACKEND_URL
      ? `${TRACKAM_BACKEND_URL.replace(/\/$/, "")}/api/oli/webhook`
      : "";
    const body = JSON.stringify({
      name: displayName || email,
      email,
      frontendUrl: TRACKAM_FRONTEND_URL,
      ...(webhookUrl ? { webhookUrl } : {}),
    });
    const url = new URL("/api/operators/signup", OLI_SWITCH_URL);
    const mod = url.protocol === "https:" ? https : http;
    const data = await new Promise((resolve, reject) => {
      const req = mod.request(
        { hostname: url.hostname, port: url.port, path: url.pathname, method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
        (res) => {
          let buf = "";
          res.on("data", (d) => { buf += d; });
          res.on("end", () => {
            try { resolve(JSON.parse(buf)); } catch { resolve({}); }
          });
        }
      );
      req.on("error", reject);
      req.end(body);
    });
    await oliAccountRepo.create(userId, { oliOperatorId: data.operatorId || null });
  } catch {
    // Best-effort — create the record without an operator ID so the user still gets pending state
    await oliAccountRepo.create(userId, {}).catch(() => {});
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION_SECONDS = Number(
  process.env.JWT_EXPIRATION_SECONDS || "3600"
);

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required for the local backend template");
}

function signPayload(payload, expiresInSeconds = JWT_EXPIRATION_SECONDS) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${Math.max(1, Math.floor(expiresInSeconds))}s`,
  });
}

async function signup({ email, password, profile = {} }) {
  const existing = await UsersService.getUserByEmail(email);
  if (existing) {
    throw new Error("Email already registered");
  }

  const uid = uuidv4();
  const passwordHash = await bcrypt.hash(password, 12);

  // Auto-promote the first user on a fresh instance to owner.
  // This is the commercial onboarding path: founder deploys Trackam, signs up,
  // and immediately gets full control. Also future-proofs multi-tenant where
  // each new org's first signup becomes the org owner.
  // Excludes synthetic system users (id wrapped in double underscores, e.g. '__org__').
  let roles = profile.roles || [];
  const capabilities = Array.isArray(profile.capabilities) && profile.capabilities.length > 0
    ? profile.capabilities
    : ["carry"];
  try {
    const { query: dbQuery } = require("../../core/db/postgres");
    const countResult = await dbQuery(
      "SELECT COUNT(*)::int AS cnt FROM users WHERE id NOT LIKE '\\_\\_%\\_\\_' ESCAPE '\\'"
    );
    if (Number(countResult.rows[0]?.cnt) === 0) {
      roles = ["owner"];
    }
  } catch {
    // Non-fatal — worst case the first user doesn't auto-promote
  }

  const userPayload = {
    email,
    displayName: profile.displayName,
    photoURL: profile.photoURL,
    roles,
    capabilities,
    emailVerified: false,
    preferences: profile.preferences || {},
    passwordHash,
  };

  const user = await UsersService.upsertUser(uid, userPayload);

  // First user on a fresh instance is the founder. They don't need someone
  // else to verify their ID — auto-stamp govt_id_verified_at so they can
  // act as a custodian immediately. (They still need to upload an ID type
  // and number eventually for the proof events to bind a real identity,
  // but they won't be blocked from operating.)
  if (roles.includes("owner")) {
    try {
      await UsersRepository.autoVerify(user.id);
    } catch {
      // Non-fatal — worst case the founder lands in their own verification
      // queue and self-approves.
    }
  }

  const idToken = signPayload({
    sub: user.id,
    email: user.email,
    roles: user.roles,
    email_verified: user.emailVerified,
  });

  const verification = {
    message: "Email verification is a manual step in the local stack",
  };

  // Provision OLI Switch operator account — fire and forget
  _provisionOliAccount(user.id, {
    email: user.email,
    displayName: profile.displayName,
  });

  return {
    idToken,
    user,
    verification,
  };
}

async function login({ email, password, context = {} }) {
  const authRecord = await UsersRepository.getAuthRecordByEmail(email);
  if (!authRecord || !authRecord.passwordHash) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const passwordMatches = await bcrypt.compare(password, authRecord.passwordHash);
  if (!passwordMatches) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const user = await UsersService.getUser(authRecord.id);

  const idToken = signPayload({
    sub: user.id,
    email: user.email,
    roles: user.roles,
    email_verified: user.emailVerified,
  });

  await SessionsRepository.createSession(user.id, {
    ip: context.ip || null,
    userAgent: context.userAgent || null,
  });

  if (context.userAgent) {
    const deviceFingerprint = `${context.userAgent}${
      context.ip ? `|${context.ip}` : ""
    }`;
    await DevicesRepository.registerDevice(user.id, deviceFingerprint);
  }

  await EventsRepository.create({
    type: "auth.login",
    payload: {
      uid: user.id,
      ip: context.ip || null,
      userAgent: context.userAgent || null,
    },
  });

  return {
    idToken,
    user,
  };
}

async function forgotPassword({ email }) {
  // In the local stack we don't have an email service; respond with a hint.
  return {
    message:
      "Password reset isn’t hooked up in the local template. Update the password in the database or extend this flow to send emails.",
    email,
  };
}

async function resendVerification({ idToken }) {
  jwt.verify(idToken, JWT_SECRET);
  return {
    message:
      "Email verification tokens are managed manually in the local stack.",
  };
}

async function logout(uid) {
  await SessionsRepository.endRecentSessions(uid);
  return { success: true };
}

async function createSessionCookie(idToken, expiresInMs) {
  const decoded = jwt.verify(idToken, JWT_SECRET);
  const expiresIn =
    typeof expiresInMs === "number" && expiresInMs > 0
      ? expiresInMs
      : JWT_EXPIRATION_SECONDS * 1000;
  const sessionPayload = {
    sub: decoded.sub,
    email: decoded.email,
    roles: decoded.roles || [],
    email_verified: Boolean(decoded.email_verified),
  };
  const expiresInSeconds = Math.max(1, Math.floor(expiresIn / 1000));
  const sessionCookie = signPayload(sessionPayload, expiresInSeconds);
  return {
    sessionCookie,
    expiresIn,
  };
}

module.exports = {
  signup,
  login,
  forgotPassword,
  resendVerification,
  logout,
  createSessionCookie,
};

