const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { TRACKAM_DIR, BACKEND_DIR, FRONTEND_DIR, PID_FILE, ENV_FILE, isInstalled } = require("./paths");
const { step, ok, fail, warn, dim, isWin } = require("./helpers");
const pg = require("./postgres");

const BACKEND_LOG = path.join(TRACKAM_DIR, ".backend.log");
const FRONTEND_LOG = path.join(TRACKAM_DIR, ".frontend.log");

module.exports = function start() {
  if (!isInstalled()) {
    fail("Trackam is not installed yet. Run 'trackam setup' first.");
    process.exit(1);
  }

  // Check if already running
  if (fs.existsSync(PID_FILE)) {
    try {
      const pids = JSON.parse(fs.readFileSync(PID_FILE, "utf8"));
      const alive = pids.some((p) => isProcessAlive(p.pid));
      if (alive) {
        fail("Trackam is already running. Run 'trackam stop' first, or 'trackam status' to check.");
        process.exit(1);
      }
    } catch {
      // Stale PID file
    }
    fs.unlinkSync(PID_FILE);
  }

  // Ensure PostgreSQL is running
  step("Starting database");
  if (!pg.ensurePostgresRunning()) {
    fail("Cannot start without PostgreSQL.");
    process.exit(1);
  }

  step("Starting Trackam");

  const pids = [];

  // Start backend — log to file so crashes are visible
  dim("Starting backend on port 4429...");
  const backendOut = fs.openSync(BACKEND_LOG, "w");
  const backend = spawn("npm", ["run", "dev"], {
    cwd: BACKEND_DIR,
    stdio: ["ignore", backendOut, backendOut],
    detached: !isWin,
    shell: true,
    windowsHide: true,
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  backend.unref();
  pids.push({ name: "backend", pid: backend.pid });
  ok(`Backend started (PID ${backend.pid})`);

  // Start frontend — log to file so crashes are visible
  dim("Starting frontend on port 3429...");
  const frontendOut = fs.openSync(FRONTEND_LOG, "w");
  const frontend = spawn("npm", ["run", "dev"], {
    cwd: FRONTEND_DIR,
    stdio: ["ignore", frontendOut, frontendOut],
    detached: !isWin,
    shell: true,
    windowsHide: true,
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  frontend.unref();
  pids.push({ name: "frontend", pid: frontend.pid });
  ok(`Frontend started (PID ${frontend.pid})`);

  // Save PIDs
  fs.writeFileSync(PID_FILE, JSON.stringify(pids, null, 2), "utf8");

  // Wait a moment then verify processes are still alive
  sleepMs(3000);

  const backendAlive = isProcessAlive(backend.pid);
  const frontendAlive = isProcessAlive(frontend.pid);

  if (!backendAlive || !frontendAlive) {
    console.log();
    if (!backendAlive) {
      fail("Backend crashed on startup!");
      dim(`Log: ${BACKEND_LOG}`);
      printLogTail(BACKEND_LOG);
    }
    if (!frontendAlive) {
      fail("Frontend crashed on startup!");
      dim(`Log: ${FRONTEND_LOG}`);
      printLogTail(FRONTEND_LOG);
    }
    process.exit(1);
  }

  console.log(`
  Trackam is running!

    Frontend:  http://127.0.0.1:3429
    Backend:   http://127.0.0.1:4429
    Database:  PostgreSQL on port ${pg.PG_PORT}

  Logs:
    Backend:   ${BACKEND_LOG}
    Frontend:  ${FRONTEND_LOG}

  Stop with:  trackam stop
`);
};

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function printLogTail(logFile) {
  try {
    const content = fs.readFileSync(logFile, "utf8");
    const lines = content.trim().split("\n");
    const tail = lines.slice(-15).join("\n");
    if (tail) {
      console.log();
      console.log(tail);
      console.log();
    }
  } catch {
    // File may not exist yet
  }
}
