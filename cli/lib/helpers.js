const { execSync, spawnSync } = require("child_process");
const crypto = require("crypto");

const isWin = process.platform === "win32";

// ── Pretty output ─────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";

function step(msg) { console.log(`\n${CYAN}${BOLD}→${RESET} ${msg}`); }
function ok(msg) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function warn(msg) { console.log(`  ${YELLOW}!${RESET} ${msg}`); }
function fail(msg) { console.error(`  ${RED}✗${RESET} ${msg}`); }
function dim(msg) { console.log(`  ${DIM}${msg}${RESET}`); }

// ── Check if a command exists ─────────────────────────────────────────────

function commandExists(cmd) {
  try {
    if (isWin) {
      execSync(`where ${cmd}`, { stdio: "ignore" });
    } else {
      execSync(`which ${cmd}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

// ── Run a shell command and stream output ─────────────────────────────────

function run(cmd, opts = {}) {
  const result = spawnSync(cmd, {
    shell: true,
    stdio: opts.silent ? "pipe" : "inherit",
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0 && !opts.ignoreError) {
    const stderr = result.stderr ? result.stderr.toString().trim() : "";
    throw new Error(`Command failed: ${cmd}${stderr ? `\n${stderr}` : ""}`);
  }
  return result.stdout ? result.stdout.toString().trim() : "";
}

// ── Prompt the user for input (sync) ──────────────────────────────────────

function prompt(question, defaultValue = "") {
  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` ${DIM}(${defaultValue})${RESET}` : "";
  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

// ── Run with retries (for flaky network commands like npm install) ────────

function runWithRetry(cmd, opts = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return run(cmd, opts);
    } catch (err) {
      if (attempt < maxRetries) {
        warn(`Attempt ${attempt}/${maxRetries} failed, retrying...`);
      } else {
        throw err;
      }
    }
  }
}

// ── Generate a secure random secret ───────────────────────────────────────

function generateSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

module.exports = { step, ok, warn, fail, dim, commandExists, run, runWithRetry, prompt, generateSecret, isWin };
