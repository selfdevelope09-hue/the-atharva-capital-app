# Upload serviceAccount + bootstrap DB on DigitalOcean (interactive SSH password OK)
# Run from project root:  powershell -ExecutionPolicy Bypass -File .\scripts\deploy-realtime-to-do.ps1

$ErrorActionPreference = "Stop"
$HostIP = "64.227.188.248"
$RemoteDir = "/opt/auron-realtime"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not (Test-Path (Join-Path $Root "package.json"))) { $Root = (Get-Location).Path }

$SaLocal = Join-Path $Root "serviceAccount.json"
if (-not (Test-Path $SaLocal)) {
  $Alt = Join-Path $Root "src\screens\serviceAccount.json"
  if (Test-Path $Alt) {
    Copy-Item $Alt $SaLocal -Force
    Write-Host "Copied serviceAccount.json to project root."
  } else {
    throw "serviceAccount.json not found in project root or src\screens\"
  }
}

Write-Host "Uploading serviceAccount.json -> ${HostIP}:${RemoteDir} ..."
scp $SaLocal "root@${HostIP}:${RemoteDir}/serviceAccount.json"

Write-Host "Uploading bootstrap script..."
scp (Join-Path $Root "server\scripts\bootstrap-env-and-db.sh") "root@${HostIP}:${RemoteDir}/scripts/bootstrap-env-and-db.sh"

Write-Host "Running remote bootstrap (Postgres + .env + db:schema)..."
ssh "root@$HostIP" "cd $RemoteDir && chmod +x scripts/bootstrap-env-and-db.sh && bash scripts/bootstrap-env-and-db.sh"

Write-Host "Done. Next on server: pm2 start ecosystem.config.cjs && pm2 save"
