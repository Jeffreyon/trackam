const fs = require("fs");
const path = require("path");
const { TRACKAM_DIR, BACKEND_DIR, FRONTEND_DIR, ENV_FILE, isInstalled } = require("./paths");
const { step, ok, warn, fail, dim, commandExists, run, prompt, generateSecret, isWin } = require("./helpers");
const pg = require("./postgres");

const REPO_URL = "https://github.com/Jeffreyon/trackam.git";

module.exports = async function setup() {
  console.log(`
  \x1b[1mTrackam\x1b[0m — Logistics Platform Setup
  ─────────────────────────────────────
`);

  // ── 1. Check prerequisites ────────────────────────────────────────────

  step("Checking prerequisites");

  // Node
  if (!commandExists("node")) {
    fail("Node.js is not installed.");
    console.log(`\n  Install Node.js 18+: https://nodejs.org\n`);
    process.exit(1);
  }
  const nodeVersion = run("node -v", { silent: true });
  const nodeMajor = parseInt(nodeVersion.replace("v", ""), 10);
  if (nodeMajor < 18) {
    fail(`Node.js ${nodeVersion} is too old — Trackam requires v18+.`);
    process.exit(1);
  }
  ok(`Node.js ${nodeVersion}`);

  // npm
  ok(`npm ${run("npm -v", { silent: true })}`);

  // Git
  if (!commandExists("git")) {
    fail("Git is not installed.");
    if (isWin) {
      console.log(`\n  Install Git: https://git-scm.com/download/win\n`);
    } else {
      console.log(`\n  Install Git: sudo apt install git  (or brew install git)\n`);
    }
    process.exit(1);
  }
  ok("Git");

  // PostgreSQL
  if (!pg.checkPostgresAvailable()) {
    process.exit(1);
  }
  ok("PostgreSQL");

  // ── 2. Clone or update repo ───────────────────────────────────────────

  step("Getting Trackam source");

  if (isInstalled()) {
    warn(`Trackam already installed at ${TRACKAM_DIR}`);
    const action = await prompt("Reinstall? This won't touch your database. (y/N)", "n");
    if (action.toLowerCase() !== "y") {
      console.log("\n  Run 'trackam start' to start the existing install.\n");
      process.exit(0);
    }
  }

  if (fs.existsSync(TRACKAM_DIR) && fs.existsSync(path.join(TRACKAM_DIR, ".git"))) {
    dim("Pulling latest from GitHub...");
    run("git pull --ff-only", { cwd: TRACKAM_DIR, ignoreError: true });
    ok("Updated");
  } else {
    dim(`Cloning into ~/trackam...`);
    run(`git clone "${REPO_URL}" "${TRACKAM_DIR}"`);
    ok("Cloned");
  }

  // ── 3. Install dependencies ───────────────────────────────────────────

  step("Installing dependencies");

  dim("Backend...");
  run("npm install", { cwd: BACKEND_DIR });
  ok("Backend");

  dim("Frontend...");
  run("npm install", { cwd: FRONTEND_DIR });
  ok("Frontend");

  // ── 4. Start PostgreSQL & create database ─────────────────────────────

  step("Setting up database");

  if (!pg.ensurePostgresRunning()) {
    fail("Cannot continue without PostgreSQL.");
    process.exit(1);
  }

  if (!pg.ensureDatabaseExists()) {
    fail("Cannot continue without the database.");
    process.exit(1);
  }

  // ── 5. Write .env (fully automatic) ───────────────────────────────────

  step("Configuring environment");

  const jwtSecret = generateSecret(32);
  const adminPassword = generateSecret(12).slice(0, 16);

  // Preserve existing .env values for OLI keys if upgrading
  let existingOliKey = "";
  let existingOliOperatorId = "";
  if (fs.existsSync(ENV_FILE)) {
    const existing = fs.readFileSync(ENV_FILE, "utf8");
    existingOliKey = extractEnvVar(existing, "OLI_API_KEY") || "";
    existingOliOperatorId = extractEnvVar(existing, "OLI_OPERATOR_ID") || "";
  }

  const envContent = `# Server
PORT=4429
FRONTEND_URL=http://127.0.0.1:3429
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60

# PostgreSQL (managed by trackam CLI — do not change)
DATABASE_URL=${pg.DATABASE_URL}

# Auth
JWT_SECRET=${jwtSecret}
JWT_EXPIRATION_SECONDS=3600

# Session cookies
SESSION_COOKIE_NAME=trackam_session
SESSION_COOKIE_MAX_AGE_DAYS=7
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_DOMAIN=

# Bootstrap admin
BOOTSTRAP_ADMIN_EMAIL=admin@trackam.local
BOOTSTRAP_ADMIN_PASSWORD=${adminPassword}
BOOTSTRAP_ADMIN_DISPLAY_NAME=Admin

# Storage
STORAGE_DIRECTORY=storage
STORAGE_URL_PREFIX=http://127.0.0.1:4429/storage

# OLI Switch (connects you to the logistics network)
OLI_SWITCH_URL=https://oli-switch-production.up.railway.app
OLI_API_KEY=${existingOliKey}
OLI_OPERATOR_ID=${existingOliOperatorId}
OLI_TRACKING_ENDPOINT=
`;

  fs.writeFileSync(ENV_FILE, envContent, "utf8");
  ok(".env configured");

  // ── 6. Run migrations ────────────────────────────────────────────────

  step("Running database migrations");
  try {
    run("npm run db:migrate", { cwd: BACKEND_DIR });
    ok("Migrations applied");
  } catch (err) {
    fail("Migration failed");
    dim(err.message);
    dim("You can retry later: trackam update");
  }

  // ── 7. Seed admin ────────────────────────────────────────────────────

  step("Creating admin account");
  try {
    run("npm run db:seed:bootstrap-admin", { cwd: BACKEND_DIR });
    ok("Admin ready");
  } catch {
    dim("Admin may already exist (skipping)");
  }

  // ── Done! ─────────────────────────────────────────────────────────────

  console.log(`
  \x1b[32m\x1b[1mSetup complete!\x1b[0m

  Start Trackam:
    \x1b[36mtrackam start\x1b[0m

  Open in browser:
    http://127.0.0.1:3429

  \x1b[1mWhat happens next:\x1b[0m
    1. Sign up at the link above
    2. Your OLI Switch operator account is auto-created
    3. Once approved, you'll get an API key by email
    4. Paste the key in Settings → start dispatching

  \x1b[2mInstalled at: ~/trackam
  Database: PostgreSQL on port ${pg.PG_PORT} (data in ~/trackam/.postgres)\x1b[0m
`);
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractEnvVar(envContent, name) {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, "m"));
  return match ? match[1].trim() : null;
}
