const { query } = require("../../core/db/postgres");

function mapRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    displayName: row.display_name || null,
    email: row.email || null,
    photoURL: row.photo_url || null,
    preferences: row.preferences || {},
    roles: row.roles || [],
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getById(id) {
  const result = await query(
    `SELECT id,
            email,
            display_name,
            photo_url,
            preferences,
            roles,
            email_verified,
            created_at,
            updated_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return mapRow(result.rows[0]);
}

async function getByEmail(email) {
  const result = await query(
    `SELECT id,
            email,
            display_name,
            photo_url,
            preferences,
            roles,
            email_verified,
            created_at,
            updated_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  return mapRow(result.rows[0]);
}

async function getAuthRecordByEmail(email) {
  const result = await query(
    `SELECT id,
            password_hash
     FROM users
     WHERE email = $1`,
    [email]
  );
  if (!result.rows[0]) {
    return null;
  }
  return {
    id: result.rows[0].id,
    passwordHash: result.rows[0].password_hash,
  };
}

async function list(limit = 50) {
  const result = await query(
    `SELECT id,
            email,
            display_name,
            photo_url,
            preferences,
            roles,
            email_verified,
            created_at,
            updated_at
     FROM users
     WHERE id NOT LIKE '\\_\\_%\\_\\_' ESCAPE '\\'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(mapRow).filter(Boolean);
}

async function upsert(id, data) {
  const prepared = {
    display_name: data.displayName || null,
    email: data.email || null,
    photo_url: data.photoURL || null,
    preferences: data.preferences || {},
    roles: Array.isArray(data.roles) ? data.roles : [],
    email_verified: data.emailVerified ? true : false,
    updated_at: data.updatedAt || Date.now(),
    password_hash: data.passwordHash || null,
  };

  await query(
    `INSERT INTO users (
      id,
      email,
      display_name,
      photo_url,
      preferences,
      roles,
      email_verified,
      created_at,
      updated_at,
      password_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      photo_url = EXCLUDED.photo_url,
      preferences = EXCLUDED.preferences,
      roles = EXCLUDED.roles,
      email_verified = EXCLUDED.email_verified,
      updated_at = EXCLUDED.updated_at,
      password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash)
  `,
    [
      id,
      prepared.email,
      prepared.display_name,
      prepared.photo_url,
      prepared.preferences,
      prepared.roles,
      prepared.email_verified,
      data.createdAt || Date.now(),
      prepared.updated_at,
      prepared.password_hash,
    ]
  );

  return getById(id);
}

module.exports = {
  getById,
  getByEmail,
  getAuthRecordByEmail,
  list,
  upsert,
};
