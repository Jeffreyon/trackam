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
const { ok, warn, fail, dim, step, commandExists, run, isWin } = require("./helpers");

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

  if (missing.length === 0) return true;

  // PostgreSQL not found — try to install it automatically
  dim("PostgreSQL not found, installing automatically...");

  if (isWin) {
    return installPostgresWindows();
  } else if (process.platform === "darwin") {
    return installPostgresMac();
  } else {
    return installPostgresLinux();
  }
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
    // Use -w (wait) but with a timeout to prevent indefinite hangs.
    // stdio: "ignore" prevents pipe deadlocks on Windows where the
    // postgres child process inherits piped handles.
    const start = spawnSync("pg_ctl", [
      "start", "-D", PG_DATA, "-l", PG_LOG,
      "-o", `-p ${PG_PORT} -h ${PG_HOST}`,
      "-w", "-t", "30",
    ], {
      encoding: "utf8",
      stdio: "ignore",
      timeout: 60_000,
    });

    if (start.status !== 0 && !isPostgresReady()) {
      fail("Failed to start PostgreSQL.");
      dim(`Check the log: ${PG_LOG}`);
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

// ── Auto-install PostgreSQL ──────────────────────────────────────────────

function installPostgresWindows() {
  // Try winget first (built into Windows 10 1709+ and Windows 11)
  if (commandExists("winget")) {
    dim("Installing PostgreSQL via winget...");
    try {
      run("winget install -e --id PostgreSQL.PostgreSQL.16 --accept-source-agreements --accept-package-agreements", { silent: false });
      // winget installs to Program Files — add to PATH for this session
      const pgPaths = findPostgresBinWindows();
      if (pgPaths) {
        process.env.PATH = `${pgPaths};${process.env.PATH}`;
        ok("PostgreSQL installed via winget");
        dim("You may need to restart your terminal for PATH changes to persist.");
        return true;
      }
    } catch {
      warn("winget install failed, trying Chocolatey...");
    }
  }

  // Try Chocolatey
  if (commandExists("choco")) {
    dim("Installing PostgreSQL via Chocolatey...");
    try {
      run("choco install postgresql16 --yes --params '/Password:postgres'", { silent: false });
      const pgPaths = findPostgresBinWindows();
      if (pgPaths) {
        process.env.PATH = `${pgPaths};${process.env.PATH}`;
        ok("PostgreSQL installed via Chocolatey");
        return true;
      }
    } catch {
      warn("Chocolatey install failed.");
    }
  }

  fail("Could not install PostgreSQL automatically.");
  dim("Please install PostgreSQL 16 manually:");
  dim("  https://www.postgresql.org/download/windows/");
  dim("  Make sure to check 'Add to PATH' during installation.");
  console.log();
  return false;
}

function installPostgresMac() {
  if (commandExists("brew")) {
    dim("Installing PostgreSQL via Homebrew...");
    try {
      run("brew install postgresql@16");
      // Homebrew may need PATH addition
      try { run("brew link postgresql@16 --force", { ignoreError: true }); } catch { /* ok */ }
      ok("PostgreSQL installed via Homebrew");
      return true;
    } catch {
      warn("Homebrew install failed.");
    }
  }

  fail("Could not install PostgreSQL automatically.");
  dim("Install Homebrew first:  /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"");
  dim("Then:  brew install postgresql@16");
  console.log();
  return false;
}

function installPostgresLinux() {
  // Detect package manager
  if (commandExists("apt-get")) {
    dim("Installing PostgreSQL via apt...");
    try {
      run("sudo apt-get update -qq");
      run("sudo apt-get install -y -qq postgresql postgresql-client");
      // Stop the system service — we manage our own instance
      run("sudo systemctl stop postgresql", { ignoreError: true });
      run("sudo systemctl disable postgresql", { ignoreError: true });
      ok("PostgreSQL installed via apt");
      return true;
    } catch {
      warn("apt install failed.");
    }
  } else if (commandExists("dnf")) {
    dim("Installing PostgreSQL via dnf...");
    try {
      run("sudo dnf install -y postgresql-server postgresql");
      run("sudo systemctl stop postgresql", { ignoreError: true });
      run("sudo systemctl disable postgresql", { ignoreError: true });
      ok("PostgreSQL installed via dnf");
      return true;
    } catch {
      warn("dnf install failed.");
    }
  } else if (commandExists("pacman")) {
    dim("Installing PostgreSQL via pacman...");
    try {
      run("sudo pacman -S --noconfirm postgresql");
      ok("PostgreSQL installed via pacman");
      return true;
    } catch {
      warn("pacman install failed.");
    }
  }

  fail("Could not install PostgreSQL automatically.");
  dim("Please install PostgreSQL manually for your distribution.");
  console.log();
  return false;
}

/**
 * Find PostgreSQL bin directory on Windows.
 * Checks common install locations since winget/choco may not update PATH immediately.
 */
function findPostgresBinWindows() {
  const candidates = [];

  // Check Program Files for any PostgreSQL version
  const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
  try {
    const pgDir = path.join(programFiles, "PostgreSQL");
    if (fs.existsSync(pgDir)) {
      const versions = fs.readdirSync(pgDir).sort().reverse(); // newest first
      for (const v of versions) {
        const binDir = path.join(pgDir, v, "bin");
        if (fs.existsSync(path.join(binDir, "psql.exe"))) {
          candidates.push(binDir);
        }
      }
    }
  } catch { /* ignore */ }

  // Also check if initdb is now on PATH after install
  if (commandExists("initdb")) return null; // already on PATH

  return candidates[0] || null;
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

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForPostgres(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isPostgresReady()) return true;
    sleepMs(500);
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
