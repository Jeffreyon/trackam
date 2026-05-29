const fs = require("fs");
const { PID_FILE } = require("./paths");
const { step, ok, warn, dim, isWin } = require("./helpers");
const pg = require("./postgres");

module.exports = function stop() {
  if (!fs.existsSync(PID_FILE)) {
    warn("No running Trackam processes found.");
    pg.stopPostgres();
    return;
  }

  step("Stopping Trackam");

  let pids;
  try {
    pids = JSON.parse(fs.readFileSync(PID_FILE, "utf8"));
  } catch {
    warn("Could not read PID file. Cleaning up.");
    fs.unlinkSync(PID_FILE);
    pg.stopPostgres();
    return;
  }

  for (const { name, pid } of pids) {
    try {
      if (isWin) {
        // On Windows, spawned shells create child trees; taskkill /T kills the tree
        require("child_process").execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      } else {
        // Kill the process group (negative PID)
        process.kill(-pid, "SIGTERM");
      }
      ok(`${name} stopped (PID ${pid})`);
    } catch {
      dim(`${name} (PID ${pid}) was already stopped`);
    }
  }

  fs.unlinkSync(PID_FILE);

  // Stop PostgreSQL
  dim("Stopping database...");
  pg.stopPostgres();
  ok("Database stopped");

  console.log();
};
