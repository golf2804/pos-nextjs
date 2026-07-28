param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[a-z0-9]{20}$")]
  [string]$TargetProjectRef,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
if (-not $Force) {
  throw "Restore replaces database objects. Re-run with -Force after verifying the target project."
}
if (-not $env:DIRECT_URL) { throw "DIRECT_URL is required." }
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) { throw "pg_restore is not installed or not in PATH." }

$source = (Resolve-Path -LiteralPath $BackupFile).Path
$checksumFile = "$source.sha256"
if (-not (Test-Path -LiteralPath $checksumFile)) {
  throw "Checksum file is required: $checksumFile"
}

$expectedHash = ((Get-Content -LiteralPath $checksumFile -Raw).Trim() -split "\s+")[0].ToLowerInvariant()
$actualHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
if ($expectedHash -ne $actualHash) {
  throw "Backup checksum verification failed."
}

try {
  $databaseUri = [Uri]$env:DIRECT_URL
} catch {
  throw "DIRECT_URL is not a valid PostgreSQL URI."
}
$databaseUser = ($databaseUri.UserInfo -split ":")[0]
$targetIdentity = "$($databaseUri.Host)|$databaseUser"
if ($targetIdentity -notmatch [Regex]::Escape($TargetProjectRef)) {
  throw "TargetProjectRef does not match the host or database user in DIRECT_URL."
}

& pg_restore --list $source | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Backup archive validation failed with exit code $LASTEXITCODE." }

Write-Host "Validated backup SHA-256: $actualHash"
Write-Host "Confirmed restore target: $TargetProjectRef ($($databaseUri.Host))"
& pg_restore --dbname=$env:DIRECT_URL --clean --if-exists --no-owner --no-privileges --exit-on-error --single-transaction $source
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE." }
Write-Host "Restore completed from: $source"
