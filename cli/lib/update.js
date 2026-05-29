const path = require("path");
const { TRACKAM_DIR, BACKEND_DIR, FRONTEND_DIR, isInstalled } = require("./paths");
const { step, ok, fail, warn, dim, run, runWithRetry } = require("./helpers");

module.exports = function update() {
  if (!isInstalled()) {
    fail("Trackam is not installed. Run 'trackam setup' first.");
    process.exit(1);
  }

  // ── 1. Pull latest code ──────────────────────────────────────────────
  step("Pulling latest code");
  run("git pull --ff-only", { cwd: TRACKAM_DIR });
  ok("Code updated");

  // ── 2. Update the CLI itself ─────────────────────────────────────────
  step("Updating CLI");
  const cliDir = path.join(TRACKAM_DIR, "cli");
  try {
    run("npm pack", { cwd: cliDir, silent: true });
    run("npm install -g trackam-*.tgz", { cwd: cliDir, silent: true });
    // Clean up tarball
    try {
      const fs = require("fs");
      const tarballs = fs.readdirSync(cliDir).filter((f) => f.startsWith("trackam-") && f.endsWith(".tgz"));
      for (const t of tarballs) fs.unlinkSync(path.join(cliDir, t));
    } catch { /* ignore cleanup errors */ }
    ok("CLI updated");
  } catch (err) {
    warn("CLI update failed — continuing with current version");
    dim(err.message || "");
  }

  // ── 3. Install dependencies ──────────────────────────────────────────
  step("Installing dependencies");
  const npmFlags = "--fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=60000 --maxsockets=5";

  dim("Backend...");
  runWithRetry(`npm install ${npmFlags}`, { cwd: BACKEND_DIR });
  ok("Backend dependencies");

  dim("Frontend...");
  runWithRetry(`npm install ${npmFlags}`, { cwd: FRONTEND_DIR });
  ok("Frontend dependencies");

  // ── 4. Run migrations ────────────────────────────────────────────────
  step("Running migrations");
  try {
    run("npm run db:migrate", { cwd: BACKEND_DIR });
    ok("Migrations applied");
  } catch (err) {
    fail("Migration failed");
    dim(err.message);
  }

  console.log(`
  \x1b[32m\x1b[1mUpdate complete!\x1b[0m

  Restart with:
    \x1b[36mtrackam stop && trackam start\x1b[0m
`);
};
