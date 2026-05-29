<# Trackam Installer — run with:
   irm https://raw.githubusercontent.com/Jeffreyon/trackam/main/cli/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  Trackam Installer" -ForegroundColor Cyan
Write-Host ""

# ── Check Node.js ──────────────────────────────────────────────────────────

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "  Node.js is not installed." -ForegroundColor Red
    Write-Host "  Install it from https://nodejs.org (v18 or newer)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  After installing Node.js, re-run this command:" -ForegroundColor Gray
    Write-Host "  irm https://raw.githubusercontent.com/Jeffreyon/trackam/main/cli/install.ps1 | iex" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

$nodeVersion = & node -v
$nodeMajor = [int]($nodeVersion -replace 'v(\d+).*', '$1')
if ($nodeMajor -lt 18) {
    Write-Host "  Node.js $nodeVersion is too old. Trackam requires v18+." -ForegroundColor Red
    Write-Host "  Update at https://nodejs.org" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host "  Node.js $nodeVersion" -ForegroundColor Green

# ── Check Git ──────────────────────────────────────────────────────────────

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Host "  Git is not installed." -ForegroundColor Red
    Write-Host "  Install it from https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host "  Git found" -ForegroundColor Green

# ── Install the trackam CLI globally ───────────────────────────────────────

Write-Host ""
Write-Host "  Installing trackam CLI..." -ForegroundColor Cyan

# Clone to a temp dir, install CLI from it
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "trackam-cli-install"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }

try { & git clone --depth 1 https://github.com/Jeffreyon/trackam.git $tempDir 2>$null } catch {}
if (-not (Test-Path (Join-Path $tempDir "cli"))) {
    Write-Host "  Failed to clone the repository. Check your internet connection." -ForegroundColor Red
    exit 1
}

# Pack the CLI into a tarball (avoids npm symlinking to the temp dir)
$cliDir = Join-Path $tempDir "cli"
$prevDir = Get-Location
Set-Location $cliDir
try { & npm pack 2>$null } catch {}
$tarball = (Get-ChildItem -Filter "trackam-*.tgz" | Select-Object -First 1).FullName
if ($tarball) {
    try { & npm install -g $tarball 2>$null } catch {}
}
Set-Location $prevDir

# Clean up temp dir
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

# Verify
$trackam = Get-Command trackam -ErrorAction SilentlyContinue
if (-not $trackam) {
    Write-Host "  npm global bin may not be in your PATH." -ForegroundColor Yellow
    Write-Host "  Try closing and re-opening your terminal, then run:" -ForegroundColor Gray
    Write-Host "    trackam setup" -ForegroundColor White
    Write-Host ""
    exit 0
}

Write-Host "  trackam CLI installed!" -ForegroundColor Green

Write-Host ""
Write-Host "  Run this to set up your logistics platform:" -ForegroundColor White
Write-Host ""
Write-Host "    trackam setup" -ForegroundColor Cyan
Write-Host ""
Write-Host "  That will clone the repo, install dependencies," -ForegroundColor Gray
Write-Host "  configure your database, and get everything ready." -ForegroundColor Gray
Write-Host ""
