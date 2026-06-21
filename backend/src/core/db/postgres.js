const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for the Postgres backend template");
}

const pool = new Pool({
  connectionString,
  max: 10,
});

// Force UTF-8 on every new connection so Unicode characters (arrows, emoji, etc.)
// don't fail on Windows Postgres instances that default to WIN1252 encoding.
pool.on("connect", (client) => {
  client.query("SET client_encoding TO 'UTF8'").catch(() => {});
});

async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result;
}

async function getClient() {
  return pool.connect();
}

async function withTransaction(callback) {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  getClient,
  withTransaction,
};
