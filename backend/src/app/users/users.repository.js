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

    // Staff profile — mirrors riders. Photo deliberately omitted from the
    // standard map so list payloads stay light; mapRowWithPhoto exposes it
    // for the admin verification modal.
    phone:                 row.phone || null,
    phoneVerifiedAt:       row.phone_verified_at || null,
    govtIdType:            row.govt_id_type || null,
    govtIdNumber:          row.govt_id_number || null,
    govtIdVerifiedAt:      row.govt_id_verified_at || null,
    govtIdVerifiedBy:      row.govt_id_verified_by || null,
    govtIdRejectionReason: row.govt_id_rejection_reason || null,
    verificationState:     deriveVerificationState(row),

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function deriveVerificationState(row) {
  if (!row.govt_id_type) return "missing";
  if (row.govt_id_verified_at) return "verified";
  if (row.govt_id_rejection_reason) return "rejected";
  return "pending";
}

function mapRowWithPhoto(row) {
  const base = mapRow(row);
  if (!base) return null;
  return { ...base, govtIdPhoto: row.govt_id_photo || null };
}

// Shared SELECT column list — every row-returning query reads the same
// shape so mapRow stays honest. govt_id_photo is excluded by default since
// it's a base64 blob; queries that need it pass includePhoto=true to
// switch to USER_COLS_WITH_PHOTO.
const USER_COLS = `
  id, email, display_name, photo_url, preferences, roles, email_verified,
  phone, phone_verified_at,
  govt_id_type, govt_id_number, govt_id_verified_at, govt_id_verified_by,
  govt_id_rejection_reason,
  created_at, updated_at
`;
const USER_COLS_WITH_PHOTO = `${USER_COLS}, govt_id_photo`;

async function getById(id, { includePhoto = false } = {}) {
  const cols = includePhoto ? USER_COLS_WITH_PHOTO : USER_COLS;
  const result = await query(
    `SELECT ${cols} FROM users WHERE id = $1`,
    [id]
  );
  return includePhoto
    ? mapRowWithPhoto(result.rows[0])
    : mapRow(result.rows[0]);
}

async function getByEmail(email) {
  const result = await query(
    `SELECT ${USER_COLS} FROM users WHERE email = $1`,
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
    `SELECT ${USER_COLS}
     FROM users
     WHERE id NOT LIKE '\\_\\_%\\_\\_' ESCAPE '\\'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(mapRow).filter(Boolean);
}

async function listPendingVerification() {
  const result = await query(
    `SELECT ${USER_COLS_WITH_PHOTO}
     FROM users
     WHERE id NOT LIKE '\\_\\_%\\_\\_' ESCAPE '\\'
       AND govt_id_type IS NOT NULL
       AND govt_id_verified_at IS NULL
       AND govt_id_rejection_reason IS NULL
     ORDER BY created_at DESC`
  );
  return result.rows.map(mapRowWithPhoto).filter(Boolean);
}

// Admin / self — write new staff profile fields. Editing the ID re-pends
// verification (mirrors riders behaviour).
async function updateStaffProfile(id, fields) {
  const setClauses = [];
  const values = [];
  let i = 1;

  if (fields.phone !== undefined) {
    setClauses.push(`phone = $${i++}`);
    values.push(fields.phone || null);
  }

  let idEdited = false;
  if (fields.govtIdType !== undefined) {
    setClauses.push(`govt_id_type = $${i++}`);
    values.push(fields.govtIdType || null);
    idEdited = true;
  }
  if (fields.govtIdNumber !== undefined) {
    setClauses.push(`govt_id_number = $${i++}`);
    values.push(fields.govtIdNumber || null);
    idEdited = true;
  }
  if (fields.govtIdPhoto !== undefined) {
    setClauses.push(`govt_id_photo = $${i++}`);
    values.push(fields.govtIdPhoto || null);
    idEdited = true;
  }
  if (idEdited) {
    setClauses.push(`govt_id_verified_at = NULL`);
    setClauses.push(`govt_id_verified_by = NULL`);
    setClauses.push(`govt_id_rejection_reason = NULL`);
  }

  if (setClauses.length === 0) return getById(id);

  setClauses.push(`updated_at = $${i++}`);
  values.push(Date.now());
  values.push(id);

  await query(
    `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${i++}`,
    values
  );
  return getById(id);
}

async function recordVerification(id, { verifiedBy, decision, rejectionReason = null }) {
  await query(
    `UPDATE users
        SET govt_id_verified_at = CASE WHEN $2 = 'approve' THEN NOW() ELSE NULL END,
            govt_id_verified_by = CASE WHEN $2 = 'approve' THEN $3 ELSE NULL END,
            govt_id_rejection_reason = CASE WHEN $2 = 'reject' THEN $4 ELSE NULL END,
            updated_at = $5
      WHERE id = $1`,
    [id, decision, verifiedBy, rejectionReason, Date.now()]
  );
  return getById(id);
}

// Mark a user as verified directly without going through the queue.
// Used during signup for the auto-promoted owner.
async function autoVerify(id) {
  await query(
    `UPDATE users
        SET govt_id_verified_at = COALESCE(govt_id_verified_at, NOW()),
            updated_at = $2
      WHERE id = $1`,
    [id, Date.now()]
  );
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
    phone: data.phone || null,
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
      password_hash,
      phone
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      photo_url = EXCLUDED.photo_url,
      preferences = EXCLUDED.preferences,
      roles = EXCLUDED.roles,
      email_verified = EXCLUDED.email_verified,
      updated_at = EXCLUDED.updated_at,
      password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
      phone = COALESCE(EXCLUDED.phone, users.phone)
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
      prepared.phone,
    ]
  );

  return getById(id);
}

module.exports = {
  getById,
  getByEmail,
  getAuthRecordByEmail,
  list,
  listPendingVerification,
  upsert,
  updateStaffProfile,
  recordVerification,
  autoVerify,
};
