/**
 * Zero-config local PostgreSQL provisioning.
 *
 * Extracted from the shared_layer scaffolder pattern:
 *   - Runs a dedicated PostgreSQL instance per project via initdb + pg_ctl
 *   - Data lives in ~/trackam/.postgres/data
 *   - Listens on a fixed port (6429) to avoid clashing with a system Postgres on 5432
 *   - Trust auth — no password needed for local dev
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { TRACKAM_DIR } = require("./paths");
const { ok, warn, fail, dim, commandExists, isWin } = require("./helpers");

const PG_PORT = 6429;
const PG_HOST = "127.0.0.1";
const PG_USER = "postgres";
const PG_DATABASE = "trackam";
const PG_DIR = path.join(TRACKAM_DIR, ".postgres");
const PG_DATA = path.join(PG_DIR, "data");
const PG_LOG = path.join(PG_DIR, "postgres.log");

const DATABASE_URL = `postgres://${PG_USER}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}`;

// ── Public API ────────────────────────────────────────────────────────────

function checkPostgresAvailable() {
  const required = ["initdb", "pg_ctl", "pg_isready", "psql"];
  const missing = required.filter((cmd) => !commandExists(cmd));

  if (missing.length > 0) {
    fail(`PostgreSQL commands not found: ${missing.join(", ")}`);
    console.log();
    if (isWin) {
      dim("Install PostgreSQL: https://www.postgresql.org/download/windows/");
      dim("Make sure to check 'Add to PATH' during installation.");
      dim("");
      dim("Or with Chocolatey:  choco install postgresql");
    } else if (process.platform === "darwin") {
      dim("Install with Homebrew:  brew install postgresql@16");
    } else {
      dim("Install:  sudo apt install postgresql postgresql-client");
    }
    console.log();
    return false;
  }
  return true;
}

function ensurePostgresRunning() {
  fs.mkdirSync(PG_DIR, { recursive: true });

  // Initialize data directory if it doesn't exist
  if (!fs.existsSync(PG_DATA)) {
    dim("Initializing PostgreSQL data directory...");
    const init = spawnSync("initdb", ["-D", PG_DATA, "-U", PG_USER, "-A", "trust"], {
      encoding: "utf8",
      stdio: "pipe",
    });
    if (init.status !== 0) {
      fail("Failed to initialize PostgreSQL data directory.");
      dim(init.stderr || "");
      return false;
    }
    ok("PostgreSQL data directory created");
  }

  // Check if already accepting connections on our port
  if (isPostgresReady()) {
    ok("PostgreSQL is running");
    return true;
  }

  // Check if our pg_ctl instance is running but not yet ready
  const status = spawnSync("pg_ctl", ["status", "-D", PG_DATA], {
    encoding: "utf8",
    stdio: "pipe",
  });
  const pgCtlRunning = status.status === 0;

  if (!pgCtlRunning) {
    dim("Starting PostgreSQL...");
    const start = spawnSync("pg_ctl", [
      "start", "-D", PG_DATA, "-l", PG_LOG,
      "-o", `-p ${PG_PORT} -h ${PG_HOST}`,
      "-w", // wait until started
    ], {
      encoding: "utf8",
      stdio: "pipe",
    });

    if (start.status !== 0 && !isPostgresReady()) {
      fail("Failed to start PostgreSQL.");
      dim(`Check the log: ${PG_LOG}`);
      dim(start.stderr || "");
      return false;
    }
  }

  // Wait for ready
  if (!waitForPostgres()) {
    fail("PostgreSQL started but isn't accepting connections.");
    dim(`Check the log: ${PG_LOG}`);
    return false;
  }

  ok(`PostgreSQL running on port ${PG_PORT}`);
  return true;
}

function ensureDatabaseExists() {
  // Check if database already exists
  const check = spawnSync("psql", [
    "-h", PG_HOST, "-p", String(PG_PORT), "-U", PG_USER,
    "-d", "postgres", "-t", "-A",
    "-c", `SELECT 1 FROM pg_database WHERE datname='${PG_DATABASE}';`,
  ], {
    encoding: "utf8",
    stdio: "pipe",
    env: { ...process.env, PGPASSWORD: "" },
  });

  if (check.stdout && check.stdout.trim() === "1") {
    ok(`Database "${PG_DATABASE}" exists`);
    return true;
  }

  // Create it
  dim(`Creating database "${PG_DATABASE}"...`);
  const create = spawnSync("psql", [
    "-h", PG_HOST, "-p", String(PG_PORT), "-U", PG_USER,
    "-d", "postgres",
    "-c", `CREATE DATABASE "${PG_DATABASE}";`,
  ], {
    encoding: "utf8",
    stdio: "pipe",
    env: { ...process.env, PGPASSWORD: "" },
  });

  if (create.status !== 0) {
    fail(`Failed to create database "${PG_DATABASE}".`);
    dim(create.stderr || "");
    return false;
  }

  ok(`Database "${PG_DATABASE}" created`);
  return true;
}

function stopPostgres() {
  if (!fs.existsSync(PG_DATA)) return;
  spawnSync("pg_ctl", ["stop", "-D", PG_DATA, "-m", "fast"], {
    stdio: "pipe",
  });
}

// ── Internals ─────────────────────────────────────────────────────────────

function isPostgresReady() {
  const result = spawnSync("pg_isready", [
    "-h", PG_HOST, "-p", String(PG_PORT), "-U", PG_USER,
  ], {
    encoding: "utf8",
    stdio: "pipe",
  });
  return result.status === 0;
}

function waitForPostgres(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isPostgresReady()) return true;
    spawnSync(isWin ? "timeout" : "sleep", isWin ? ["/t", "1", "/nobreak"] : ["0.5"], { stdio: "ignore" });
  }
  return false;
}

module.exports = {
  PG_PORT, PG_HOST, PG_USER, PG_DATABASE, DATABASE_URL,
  checkPostgresAvailable,
  ensurePostgresRunning,
  ensureDatabaseExists,
  stopPostgres,
};
