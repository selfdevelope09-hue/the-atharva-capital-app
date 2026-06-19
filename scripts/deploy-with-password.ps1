# One-time password deploy (set env DO_ROOT_PASSWORD before running — do not commit password)
param(
  [string]$Password = $env:DO_ROOT_PASSWORD
)

$ErrorActionPreference = "Stop"
$Root = "c:\Users\ATHARVA\the-atharva-capital-app"
$HostIP = "64.227.188.248"
$Remote = "/opt/auron-realtime"

if (-not $Password) {
  $sec = Read-Host "DigitalOcean root password" -AsSecureString
  $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
  Install-Module Posh-SSH -Scope CurrentUser -Force -AllowClobber
}
Import-Module Posh-SSH

& powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\fix-sh-lf.ps1") | Out-Null

$secPass = ConvertTo-SecureString $Password -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential("root", $secPass)

Write-Host "Connecting..."
$session = New-SSHSession -ComputerName $HostIP -Credential $cred -AcceptKey -Force
if (-not $session) { throw "SSH session failed" }

# Option A: install deploy public key for future passwordless SSH
$pubKeyPath = Join-Path $Root ".deploy-keys\do_ed25519.pub"
if (Test-Path $pubKeyPath) {
  $pub = (Get-Content $pubKeyPath -Raw).Trim().Replace("'", "'\''")
  $keyCmd = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && grep -qxF '$pub' ~/.ssh/authorized_keys 2>/dev/null || echo '$pub' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo DEPLOY_KEY_OK"
  $kr = Invoke-SSHCommand -SessionId $session.SessionId -Command $keyCmd -TimeOut 60
  Write-Host ($kr.Output -join "`n")
  if ($kr.ExitStatus -ne 0) { Write-Host $kr.Error }
}

function Remote($cmd) {
  $r = Invoke-SSHCommand -SessionId $session.SessionId -Command $cmd -TimeOut 600
  if ($r.ExitStatus -ne 0) {
    Write-Host $r.Output
    Write-Host $r.Error
    throw "Remote failed ($($r.ExitStatus)): $cmd"
  }
  return $r.Output
}

Write-Host "Uploading files..."
Set-SCPItem -ComputerName $HostIP -Credential $cred -Path (Join-Path $Root "serviceAccount.json") -Destination "$Remote/serviceAccount.json" -AcceptKey -Force
Set-SCPItem -ComputerName $HostIP -Credential $cred -Path (Join-Path $Root "server\scripts\bootstrap-env-and-db.sh") -Destination "$Remote/scripts/bootstrap-env-and-db.sh" -AcceptKey -Force
Set-SCPItem -ComputerName $HostIP -Credential $cred -Path (Join-Path $Root "server\scripts\server-one-paste-bootstrap.sh") -Destination "$Remote/scripts/server-one-paste-bootstrap.sh" -AcceptKey -Force

Write-Host "Bootstrap + schema..."
Remote "cd $Remote && sed -i 's/\r$//' scripts/*.sh 2>/dev/null; chmod +x scripts/server-one-paste-bootstrap.sh scripts/bootstrap-env-and-db.sh && bash scripts/server-one-paste-bootstrap.sh"

Write-Host "PM2 start..."
Remote "cd $Remote && (command -v pm2 >/dev/null || npm install -g pm2) && pm2 delete auron-realtime 2>/dev/null || true && pm2 start ecosystem.config.cjs && pm2 save"
$health = Remote "curl -s http://127.0.0.1:3000/health || true"
Write-Host $health

Remove-SSHSession -SessionId $session.SessionId | Out-Null
Write-Host "DEPLOY_SUCCESS"
