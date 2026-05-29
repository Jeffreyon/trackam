#!/bin/bash
# Trackam Installer — run with:
#   curl -fsSL https://raw.githubusercontent.com/Jeffreyon/trackam/main/cli/install.sh | bash

set -e

echo ""
echo "  Trackam Installer"
echo ""

# ── Check Node.js ──────────────────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js is not installed."
  echo "    Install it from https://nodejs.org (v18 or newer)"
  echo ""
  echo "    Or:  curl -fsSL https://fnm.vercel.app/install | bash && fnm install 22"
  echo ""
  exit 1
fi

NODE_VERSION=$(node -v)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "  ✗ Node.js $NODE_VERSION is too old. Trackam requires v18+."
  exit 1
fi
echo "  ✓ Node.js $NODE_VERSION"

# ── Check Git ──────────────────────────────────────────────────────────────

if ! command -v git &>/dev/null; then
  echo "  ✗ Git is not installed."
  echo "    Install it:  sudo apt install git  (or brew install git)"
  echo ""
  exit 1
fi
echo "  ✓ Git found"

# ── Install the trackam CLI globally ───────────────────────────────────────

echo ""
echo "  Installing trackam CLI..."

TEMP_DIR=$(mktemp -d)
git clone --depth 1 https://github.com/Jeffreyon/trackam.git "$TEMP_DIR" 2>/dev/null

# Pack into tarball to avoid npm symlinking to the temp dir
cd "$TEMP_DIR/cli"
npm pack 2>/dev/null
npm install -g trackam-*.tgz 2>/dev/null
cd - >/dev/null

rm -rf "$TEMP_DIR"

if ! command -v trackam &>/dev/null; then
  echo "  ! npm global bin may not be in your PATH."
  echo "    Add this to your shell config:  export PATH=\"\$(npm config get prefix)/bin:\$PATH\""
  echo ""
  echo "    Then run:  trackam setup"
  echo ""
  exit 0
fi

echo "  ✓ trackam CLI installed!"
echo ""
echo "  Run this to set up your logistics platform:"
echo ""
echo "    trackam setup"
echo ""
