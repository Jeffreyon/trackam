const fs = require("fs");
const { execSync } = require("child_process");
const { PID_FILE } = require("./paths");
const { step, ok, warn, dim, isWin } = require("./helpers");
const pg = require("./postgres");

module.exports = function stop() {
  step("Stopping Trackam");

  // Kill by port — most reliable on Windows where process trees get messy
  killPort(4429, "Backend");
  killPort(3429, "Frontend");

  // Clean up PID file
  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }

  // Stop PostgreSQL
  dim("Stopping database...");
  pg.stopPostgres();
  ok("Database stopped");

  console.log();
};

function killPort(port, label) {
  try {
    if (isWin) {
      // Find all PIDs listening on this port
      const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      const pids = new Set();
      for (const line of out.trim().split("\n")) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== "0") pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
        } catch {
          // Already dead
        }
      }
      if (pids.size > 0) {
        ok(`${label} stopped (port ${port})`);
      } else {
        dim(`${label} was not running`);
      }
    } else {
      // Unix: use lsof to find the PID
      const out = execSync(`lsof -ti :${port}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
      const pids = out.trim().split("\n").filter(Boolean);
      for (const pid of pids) {
        try { process.kill(Number(pid), "SIGTERM"); } catch { /* already dead */ }
      }
      if (pids.length > 0) {
        ok(`${label} stopped (port ${port})`);
      } else {
        dim(`${label} was not running`);
      }
    }
  } catch {
    dim(`${label} was not running`);
  }
}
