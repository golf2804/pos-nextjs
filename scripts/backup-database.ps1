param(
  [string]$OutputDirectory = "backups",
  [ValidateRange(1, 3650)][int]$RetentionDays = 30,
  [switch]$Prune
)

$ErrorActionPreference = "Stop"
if (-not $env:DIRECT_URL) { throw "DIRECT_URL is required." }
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) { throw "pg_dump is not installed or not in PATH." }

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$targetDirectory = [IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
$rootPrefix = $root.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $targetDirectory.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "OutputDirectory must resolve inside the project workspace."
}

New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss'Z'")
$target = Join-Path $targetDirectory "inventory-$stamp.dump"
$partial = "$target.partial"

try {
  & pg_dump --dbname=$env:DIRECT_URL --format=custom --no-owner --no-privileges --file=$partial
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
  if (-not (Test-Path -LiteralPath $partial) -or (Get-Item -LiteralPath $partial).Length -eq 0) {
    throw "pg_dump produced an empty backup."
  }

  Move-Item -LiteralPath $partial -Destination $target
  $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
  "$hash  $([IO.Path]::GetFileName($target))" | Set-Content -LiteralPath "$target.sha256" -Encoding ascii
  [ordered]@{
    createdAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    file = [IO.Path]::GetFileName($target)
    bytes = (Get-Item -LiteralPath $target).Length
    sha256 = $hash
    pgDumpVersion = (& pg_dump --version)
  } | ConvertTo-Json | Set-Content -LiteralPath "$target.json" -Encoding utf8
} finally {
  if (Test-Path -LiteralPath $partial) { Remove-Item -LiteralPath $partial -Force }
}

if ($Prune) {
  $cutoff = (Get-Date).ToUniversalTime().AddDays(-$RetentionDays)
  Get-ChildItem -LiteralPath $targetDirectory -File -Filter "inventory-*.dump" |
    Where-Object { $_.LastWriteTimeUtc -lt $cutoff } |
    ForEach-Object {
      foreach ($path in @($_.FullName, "$($_.FullName).sha256", "$($_.FullName).json")) {
        if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
      }
    }
}

Write-Host "Backup created and checksummed: $target"
