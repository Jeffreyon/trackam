#!/usr/bin/env node

/**
 * trackam CLI — install and manage your Trackam logistics platform.
 *
 * Commands:
 *   trackam setup   — Clone repo, install deps, create DB, configure env, run migrations
 *   trackam start   — Start backend + frontend dev servers
 *   trackam stop    — Stop running Trackam processes
 *   trackam status  — Show whether Trackam is running
 *   trackam update  — Pull latest code and re-run migrations
 */

const command = process.argv[2];

const COMMANDS = {
  setup:    () => require("../lib/setup")(),
  start:    () => require("../lib/start")(),
  stop:     () => require("../lib/stop")(),
  status:   () => require("../lib/status")(),
  update:   () => require("../lib/update")(),
  carriers: () => require("../lib/carriers")(),
};

if (!command || command === "--help" || command === "-h") {
  console.log(`
  trackam — Logistics platform CLI

  Usage:
    trackam setup      Set up Trackam on this machine
    trackam start      Start the platform (backend + frontend)
    trackam stop       Stop running processes
    trackam status     Check if Trackam is running
    trackam update     Pull latest code and apply migrations
    trackam carriers   Review and approve carrier profile submissions

  First time? Run:  trackam setup
`);
  process.exit(0);
}

if (!COMMANDS[command]) {
  console.error(`Unknown command: ${command}\nRun 'trackam --help' for usage.`);
  process.exit(1);
}

COMMANDS[command]();
