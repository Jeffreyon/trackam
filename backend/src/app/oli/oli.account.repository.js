const { query } = require("../../core/db/postgres");

async function create(userId, { oliOperatorId = null } = {}) {
  const r = await query(
    `INSERT INTO oli_accounts (user_id, oli_operator_id, oli_status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (user_id) DO UPDATE
       SET oli_operator_id = COALESCE(EXCLUDED.oli_operator_id, oli_accounts.oli_operator_id),
           updated_at = NOW()
     RETURNING *`,
    [userId, oliOperatorId]
  );
  return r.rows[0];
}

async function findByUserId(userId) {
  const r = await query(`SELECT * FROM oli_accounts WHERE user_id = $1`, [userId]);
  return r.rows[0] || null;
}

async function saveApiKey(userId, apiKey) {
  const r = await query(
    `UPDATE oli_accounts
        SET oli_api_key = $2, oli_status = 'active', updated_at = NOW()
      WHERE user_id = $1
      RETURNING *`,
    [userId, apiKey]
  );
  return r.rows[0] || null;
}

/**
 * Return the first active operator's API key.
 * Used as a fallback for unauthenticated (public) requests in single-tenant
 * deployments where only one operator exists.
 */
async function findDefaultApiKey() {
  const r = await query(
    `SELECT oli_api_key FROM oli_accounts
     WHERE oli_api_key IS NOT NULL AND oli_status = 'active'
     ORDER BY created_at ASC LIMIT 1`
  );
  return r.rows[0]?.oli_api_key || null;
}

module.exports = { create, findByUserId, saveApiKey, findDefaultApiKey };
