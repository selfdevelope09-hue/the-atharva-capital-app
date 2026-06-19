# Deploy server + migration to DigitalOcean (SSH key)
$ErrorActionPreference = "Stop"
$HostIP = "64.227.188.248"
$RemoteDir = "/opt/auron-realtime"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Key = Join-Path $Root ".deploy-keys\do_ed25519"
$ssh = @("ssh", "-i", $Key, "-o", "StrictHostKeyChecking=no", "root@$HostIP")
$scp = @("scp", "-i", $Key, "-o", "StrictHostKeyChecking=no")

if (-not (Test-Path $Key)) { throw "Missing SSH key: $Key" }

$SaLocal = Join-Path $Root "serviceAccount.json"
if (-not (Test-Path $SaLocal)) {
  $Alt = Join-Path $Root "src\screens\serviceAccount.json"
  if (Test-Path $Alt) { Copy-Item $Alt $SaLocal -Force }
  else { throw "serviceAccount.json not found" }
}

Write-Host "Sync server/ -> $RemoteDir ..."
& scp @("-i", $Key, "-o", "StrictHostKeyChecking=no", "-r", (Join-Path $Root "server\src"), "root@${HostIP}:${RemoteDir}/")
& scp @("-i", $Key, "-o", "StrictHostKeyChecking=no", "-r", (Join-Path $Root "server\scripts"), "root@${HostIP}:${RemoteDir}/")
$ClPath = Join-Path $Root "charting_library"
if (Test-Path (Join-Path $ClPath "charting_library.js")) {
  Write-Host "Sync charting_library/ -> public on server (optional nginx static) ..."
  ssh @("-i", $Key, "-o", "StrictHostKeyChecking=no", "root@$HostIP", "mkdir -p /var/www/charting_library")
  scp @("-i", $Key, "-o", "StrictHostKeyChecking=no", "-r", "$ClPath\*", "root@${HostIP}:/var/www/charting_library/")
}
& scp @("-i", $Key, "-o", "StrictHostKeyChecking=no", "-r", (Join-Path $Root "server\sql"), "root@${HostIP}:${RemoteDir}/")
& scp @("-i", $Key, "-o", "StrictHostKeyChecking=no", (Join-Path $Root "server\package.json"), "root@${HostIP}:${RemoteDir}/")
& scp @("-i", $Key, "-o", "StrictHostKeyChecking=no", (Join-Path $Root "server\ecosystem.config.cjs"), "root@${HostIP}:${RemoteDir}/")
& scp @("-i", $Key, "-o", "StrictHostKeyChecking=no", $SaLocal, "root@${HostIP}:${RemoteDir}/serviceAccount.json")
& scp @("-i", $Key, "-o", "StrictHostKeyChecking=no", (Join-Path $Root "scripts\migrate-firestore-to-postgres.js"), "root@${HostIP}:${RemoteDir}/scripts/")
& scp @("-i", $Key, "-o", "StrictHostKeyChecking=no", (Join-Path $Root "scripts\migrate-firestore-admin-to-postgres.js"), "root@${HostIP}:${RemoteDir}/scripts/")

$remote = 'set -e; cd /opt/auron-realtime; npm install --omit=dev 2>/dev/null || npm install; mkdir -p uploads; grep -q PUBLIC_UPLOAD_BASE_URL .env 2>/dev/null || echo PUBLIC_UPLOAD_BASE_URL=https://www.theatharvacapital.com >> .env; grep -q UPLOAD_DIR .env 2>/dev/null || echo UPLOAD_DIR=/opt/auron-realtime/uploads >> .env; set -a; [ -f .env ] && . ./.env; set +a; node scripts/apply-removed-user-schema.js; node scripts/apply-chat-schema.js; node scripts/apply-community-schema.js; node scripts/apply-media-tv-schema.js; node scripts/apply-admin-schema.js; node scripts/apply-creds-schema.js; node scripts/apply-paid-member-schema.js; node scripts/apply-paid-plan-v2-schema.js; node scripts/apply-app-login-schema.js; node scripts/backfill-app-login.js; node scripts/sync-showcase-logins.js; node scripts/apply-paid-balance-reset-schema.js; node scripts/apply-paid-free-reset-schema.js; node scripts/apply-unlimited-pnl-schema.js; node scripts/reset-stale-leaderboard-campaign.js; pm2 restart auron-realtime --update-env || pm2 start ecosystem.config.cjs; pm2 save; curl -s http://127.0.0.1:3000/health'

& ssh @("-i", $Key, "-o", "StrictHostKeyChecking=no", "root@$HostIP", $remote)
Write-Host "DEPLOY_OK"
