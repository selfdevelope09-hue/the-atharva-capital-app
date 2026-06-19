$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Sa = Join-Path $Root "serviceAccount.json"
if (-not (Test-Path $Sa)) {
  throw "serviceAccount.json missing at $Sa"
}
$null = Get-Content $Sa -Raw | ConvertFrom-Json

$saB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content $Sa -Raw)))
$bootstrapPath = Join-Path $Root "server\scripts\bootstrap-env-and-db.sh"
$bootB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content $bootstrapPath -Raw)))

$template = @'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/auron-realtime || { mkdir -p /opt/auron-realtime && cd /opt/auron-realtime; }
echo "==> Decoding serviceAccount.json"
echo __SA_B64__ | base64 -d > serviceAccount.json
echo "==> Decoding bootstrap script"
mkdir -p scripts
echo __BOOT_B64__ | base64 -d > scripts/bootstrap-env-and-db.sh
chmod +x scripts/bootstrap-env-and-db.sh
bash scripts/bootstrap-env-and-db.sh
'@

$out = $template.Replace("__SA_B64__", $saB64).Replace("__BOOT_B64__", $bootB64)
$outPath = Join-Path $Root "scripts\server-one-paste-bootstrap.sh"
[System.IO.File]::WriteAllText($outPath, $out)
Write-Host "Created: $outPath"
Write-Host "Size: $((Get-Item $outPath).Length) bytes"
