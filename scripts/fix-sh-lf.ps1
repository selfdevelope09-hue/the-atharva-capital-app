$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$files = @(
  (Join-Path $Root "server\scripts\bootstrap-env-and-db.sh"),
  (Join-Path $Root "scripts\server-one-paste-bootstrap.sh")
)
foreach ($f in $files) {
  if (-not (Test-Path $f)) { continue }
  $t = [IO.File]::ReadAllText($f) -replace "`r`n", "`n" -replace "`r", "`n"
  [IO.File]::WriteAllText($f, $t, (New-Object System.Text.UTF8Encoding $false))
  Write-Host "LF fixed: $f"
}
