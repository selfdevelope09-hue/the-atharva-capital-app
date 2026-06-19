# Full automated deploy when SSH key is authorized on droplet
$ErrorActionPreference = "Stop"
$Root = "c:\Users\ATHARVA\the-atharva-capital-app"
$HostIP = "64.227.188.248"
$Remote = "/opt/auron-realtime"
$Key = Join-Path $Root ".deploy-keys\do_ed25519"
$SshOpts = @("-i", $Key, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes")

& powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\fix-sh-lf.ps1") | Out-Null

function Invoke-Remote($cmd) {
  & ssh @SshOpts "root@${HostIP}" $cmd
  if ($LASTEXITCODE -ne 0) { throw "Remote failed: $cmd" }
}

Write-Host "Testing SSH key auth..."
& ssh @SshOpts "root@${HostIP}" "echo SSH_OK"
if ($LASTEXITCODE -ne 0) {
  $pub = Get-Content "$Key.pub" -Raw
  Write-Host ""
  Write-Host "SSH key not authorized yet. Add this public key in DigitalOcean:"
  Write-Host " Droplet -> Access -> Add SSH Key"
  Write-Host " OR on server (already logged in):"
  Write-Host " mkdir -p ~/.ssh && echo '$($pub.Trim())' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
  Write-Host ""
  exit 1
}

Write-Host "Uploading files..."
& scp @SshOpts (Join-Path $Root "serviceAccount.json") "root@${HostIP}:${Remote}/serviceAccount.json"
& scp @SshOpts (Join-Path $Root "server\scripts\bootstrap-env-and-db.sh") "root@${HostIP}:${Remote}/scripts/bootstrap-env-and-db.sh"
& scp @SshOpts (Join-Path $Root "server\scripts\server-one-paste-bootstrap.sh") "root@${HostIP}:${Remote}/scripts/server-one-paste-bootstrap.sh"

Write-Host "Running bootstrap..."
Invoke-Remote "cd $Remote && sed -i 's/\r$//' scripts/*.sh && chmod +x scripts/server-one-paste-bootstrap.sh scripts/bootstrap-env-and-db.sh && bash scripts/server-one-paste-bootstrap.sh"

Write-Host "Starting PM2..."
Invoke-Remote "cd $Remote && (command -v pm2 >/dev/null || npm install -g pm2) && pm2 delete auron-realtime 2>/dev/null || true && pm2 start ecosystem.config.cjs && pm2 save"
Invoke-Remote "curl -s http://127.0.0.1:3000/health || true"

Write-Host "DEPLOY_SUCCESS"
