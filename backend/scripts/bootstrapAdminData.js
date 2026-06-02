const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { ensureScaffoldRoles } = require("./demoSeedData");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function ensureOwnerRole(roles) {
  const nextRoles = Array.isArray(roles) ? [...roles] : [];
  if (!nextRoles.includes("owner")) {
    nextRoles.push("owner");
  }
  return nextRoles;
}

async function seedBootstrapAdmin(pool, options = {}) {
  const email = normalizeEmail(options.email);
  const password = String(options.password || "");
  const displayName = String(
    options.displayName || process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME || "Scaffold Admin"
  ).trim();
  const now = options.now || Date.now();

  if (!email) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL is required to seed the bootstrap admin.");
  }
  if (!password) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD is required to seed the bootstrap admin.");
  }

  await ensureScaffoldRoles(pool);

  const passwordHash = await bcrypt.hash(password, 12);
  const existingResult = await pool.query(
    `SELECT id, roles
     FROM users
     WHERE email = $1`,
    [email]
  );

  const existingUser = existingResult.rows[0];

  if (existingUser) {
    const roles = ensureOwnerRole(existingUser.roles);
    await pool.query(
      `UPDATE users
       SET display_name = $2,
           roles = $3,
           email_verified = $4,
           updated_at = $5,
           password_hash = $6
       WHERE id = $1`,
      [existingUser.id, displayName, roles, true, now, passwordHash]
    );

    return {
      id: existingUser.id,
      email,
      displayName,
      roles,
      created: false,
    };
  }

  const id = crypto.randomUUID();
  const roles = ["owner"];
  await pool.query(
    `INSERT INTO users (id, email, display_name, roles, email_verified, created_at, updated_at, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, email, displayName, roles, true, now, now, passwordHash]
  );

  return {
    id,
    email,
    displayName,
    roles,
    created: true,
  };
}

module.exports = {
  seedBootstrapAdmin,
};
