$ErrorActionPreference = "Stop"

$managedUsername = (Read-Host "Username").Trim().ToLowerInvariant()
$managedPasswordSecure = Read-Host "New password" -AsSecureString
$confirmPasswordSecure = Read-Host "Confirm password" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($managedPasswordSecure)
$confirmPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmPasswordSecure)

try {
  $managedPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $confirmPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($confirmPointer)
  if ($managedPassword.Length -lt 8) {
    throw "Password must be at least 8 characters."
  }
  if ($managedPassword -cne $confirmPassword) {
    throw "Passwords do not match."
  }

  $env:MANAGED_USERNAME = $managedUsername
  $env:MANAGED_PASSWORD = $managedPassword
  & npx tsx scripts/set-managed-password.ts
  if ($LASTEXITCODE -ne 0) {
    throw "Password update failed."
  }
} finally {
  Remove-Item Env:MANAGED_USERNAME -ErrorAction SilentlyContinue
  Remove-Item Env:MANAGED_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($confirmPointer)
  $managedPassword = $null
  $confirmPassword = $null
}
