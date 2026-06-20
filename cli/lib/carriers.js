/**
 * trackam carriers — review and approve carrier profile submissions
 *
 * Calls the OLI Switch admin API to list all carrier profiles
 * (published and pending), then lets the admin interactively
 * approve or reject each one.
 *
 * Requires:
 *   OLI_ADMIN_SECRET=<switch-admin-secret> trackam carriers
 *
 * The switch URL is read from ~/trackam/backend/.env (OLI_SWITCH_URL).
 */

const https   = require("https");
const http    = require("http");
const fs      = require("fs");
const path    = require("path");
const { step, ok, warn, fail, dim, prompt } = require("./helpers");
const { TRACKAM_DIR } = require("./paths");

const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED    = "\x1b[31m";
const CYAN   = "\x1b[36m";
const DIM    = "\x1b[2m";

// ── Config ────────────────────────────────────────────────────────────────────

function readEnvFile() {
  const envPath = path.join(TRACKAM_DIR, "backend", ".env");
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

// ── HTTP helper (no external deps) ────────────────────────────────────────────

function request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const lib     = parsed.protocol === "https:" ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const req = lib.request({
      method,
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      headers:  {
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(10_000, () => { req.destroy(new Error("Request timed out")); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Display helpers ───────────────────────────────────────────────────────────

function pad(str, len) {
  const s = String(str ?? "");
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

function formatStatus(profile) {
  return profile.isPublished
    ? `${GREEN}✓ Published${RESET}`
    : `${YELLOW}· Draft${RESET}`;
}

function printTable(profiles) {
  console.log();
  console.log(`  ${BOLD}${CYAN}${pad("#", 4)}${pad("Name", 28)}${pad("Country", 9)}${pad("Type", 14)}Status${RESET}`);
  console.log(`  ${"─".repeat(70)}`);
  profiles.forEach((p, i) => {
    const num     = pad(i + 1, 4);
    const name    = pad(p.name ?? "—", 28);
    const country = pad((p.country ?? "—").toUpperCase(), 9);
    const type    = pad(p.capacityType ?? "—", 14);
    const status  = p.isPublished ? `${GREEN}✓ Published${RESET}` : `${YELLOW}· Draft${RESET}`;
    console.log(`  ${DIM}${num}${RESET}${name}${country}${type}${status}`);
  });
  console.log();
}

function printDetail(p) {
  console.log();
  console.log(`  ${BOLD}── ${p.name} ──${RESET}`);
  console.log(`  ${DIM}Operator ID:${RESET}  ${p.operatorId}`);
  console.log(`  ${DIM}Email:${RESET}        ${p.email ?? "—"}`);
  console.log(`  ${DIM}Status:${RESET}       ${formatStatus(p)}`);
  console.log(`  ${DIM}Country:${RESET}      ${(p.country ?? "—").toUpperCase()}`);
  console.log(`  ${DIM}Capacity:${RESET}     ${p.capacityType ?? "—"}`);
  if (p.fleetSize)  console.log(`  ${DIM}Fleet size:${RESET}   ${p.fleetSize} vehicles`);
  if (p.specializations?.length) {
    console.log(`  ${DIM}Specializations:${RESET} ${p.specializations.join(", ")}`);
  }
  if (p.bio) {
    const preview = p.bio.length > 120 ? p.bio.slice(0, 120) + "…" : p.bio;
    console.log(`  ${DIM}Bio:${RESET}          ${preview}`);
  }
  if (p.serviceAreas?.length) {
    const areas = p.serviceAreas.map((a) => `${a.city}${a.state ? ", " + a.state : ""} (${a.country ?? p.country ?? "?"})`.trim()).join(" · ");
    console.log(`  ${DIM}Coverage:${RESET}     ${areas}`);
  }
  if (p.pricingModel) {
    const rate = p.pricingModel !== "quoted" && p.baseRate > 0 ? ` · ${p.currency ?? ""} ${(p.baseRate / 100).toLocaleString()}` : "";
    console.log(`  ${DIM}Pricing:${RESET}      ${p.pricingModel}${rate}`);
  }
  if (p.frontendUrl) console.log(`  ${DIM}Website:${RESET}      ${p.frontendUrl}`);
  if (p.updatedAt)   console.log(`  ${DIM}Updated:${RESET}      ${new Date(p.updatedAt).toLocaleDateString()}`);
  console.log();
}

// ── Main ─────────────────────────────────────────────────────────────────────

module.exports = async function carriers() {
  const fileEnv    = readEnvFile();
  const switchUrl  = process.env.OLI_SWITCH_URL  ?? fileEnv.OLI_SWITCH_URL  ?? "https://switch-production-5384.up.railway.app";
  const adminSecret = process.env.OLI_ADMIN_SECRET ?? "";

  if (!adminSecret) {
    console.log();
    warn("OLI_ADMIN_SECRET is not set.");
    dim("Run:  OLI_ADMIN_SECRET=<secret> trackam carriers");
    dim(`Find it in your Railway switch service environment variables.`);
    console.log();
    process.exit(1);
  }

  const headers = { "x-admin-secret": adminSecret };

  console.log();
  console.log(`  ${BOLD}OLI Carrier Network — Profile Review${RESET}`);
  dim(`  Switch: ${switchUrl}`);

  step("Fetching carrier profiles…");

  let profiles;
  try {
    const res = await request("GET", `${switchUrl}/api/operators/carrier-profiles`, null, headers);
    if (res.status === 403) {
      fail("Invalid admin secret.");
      process.exit(1);
    }
    if (res.status !== 200) {
      fail(`Switch returned ${res.status}: ${JSON.stringify(res.body)}`);
      process.exit(1);
    }
    profiles = Array.isArray(res.body) ? res.body : [];
  } catch (err) {
    fail(`Could not reach switch: ${err.message}`);
    process.exit(1);
  }

  if (profiles.length === 0) {
    dim("  No carrier profiles found.");
    console.log();
    return;
  }

  ok(`Found ${profiles.length} profile${profiles.length !== 1 ? "s" : ""}`);

  while (true) {
    printTable(profiles);

    const input = await prompt(`Enter number to review, or ${CYAN}q${RESET} to quit`, "q");
    if (!input || input.toLowerCase() === "q") break;

    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= profiles.length) {
      warn("Invalid selection.");
      continue;
    }

    const p = profiles[idx];
    printDetail(p);

    const action = await prompt(
      `${CYAN}[a]${RESET}pprove  ${YELLOW}[u]${RESET}npublish  ${DIM}[s]${RESET}kip`,
      "s"
    );

    if (action.toLowerCase() === "a" || action.toLowerCase() === "approve") {
      try {
        const res = await request("PATCH", `${switchUrl}/api/operators/${p.operatorId}/carrier-profile/publish`, { published: true }, headers);
        if (res.status === 200) {
          ok(`${p.name} approved and published.`);
          profiles[idx] = { ...profiles[idx], isPublished: true };
        } else {
          fail(`Failed: ${JSON.stringify(res.body)}`);
        }
      } catch (err) {
        fail(err.message);
      }

    } else if (action.toLowerCase() === "u" || action.toLowerCase() === "unpublish") {
      try {
        const res = await request("PATCH", `${switchUrl}/api/operators/${p.operatorId}/carrier-profile/publish`, { published: false }, headers);
        if (res.status === 200) {
          ok(`${p.name} unpublished.`);
          profiles[idx] = { ...profiles[idx], isPublished: false };
        } else {
          fail(`Failed: ${JSON.stringify(res.body)}`);
        }
      } catch (err) {
        fail(err.message);
      }

    } else {
      dim("  Skipped.");
    }
  }

  console.log();
  dim("  Done.");
  console.log();
};
