param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$SupabaseArgs
)

$ErrorActionPreference = "Stop"

$projectRef = "edeprsrdumcnhixijlfu"
$poolerHost = "aws-1-eu-west-1.pooler.supabase.com"
$envFilePath = Join-Path $PSScriptRoot "..\.env.supabase.local"

function Get-CanonicalDbPassword {
  if ($env:SUPABASE_DB_PASSWORD_CANONICAL) {
    return $env:SUPABASE_DB_PASSWORD_CANONICAL.Trim()
  }

  if ($env:SUPABASE_DB_PASSWORD_DEV) {
    return $env:SUPABASE_DB_PASSWORD_DEV.Trim()
  }

  if (-not (Test-Path $envFilePath)) {
    throw "Falta .env.supabase.local. Crea el archivo a partir de .env.supabase.local.example o exporta SUPABASE_DB_PASSWORD_CANONICAL."
  }

  $line = Get-Content -Path $envFilePath |
    Where-Object { $_ -match '^\s*SUPABASE_DB_PASSWORD_(CANONICAL|DEV)\s*=' } |
    Select-Object -First 1

  if (-not $line) {
    throw "No se encontró SUPABASE_DB_PASSWORD_CANONICAL en .env.supabase.local."
  }

  $value = ($line -split "=", 2)[1].Trim()
  return $value.Trim('"').Trim("'")
}

if (-not $SupabaseArgs -or $SupabaseArgs.Count -eq 0) {
  throw "Uso: powershell -File scripts/supabase-dev.ps1 <comando supabase>. Ejemplo: powershell -File scripts/supabase-dev.ps1 migration list"
}

$dbPassword = Get-CanonicalDbPassword
$dbUrl = "postgresql://postgres.${projectRef}:${dbPassword}@${poolerHost}:5432/postgres"
$safeDbUrl = "postgresql://postgres.${projectRef}:***@${poolerHost}:5432/postgres"

$command = @("supabase") + $SupabaseArgs + @("--db-url", $dbUrl)

Write-Host "Ejecutando: npx supabase $($SupabaseArgs -join ' ') --db-url $safeDbUrl" -ForegroundColor Cyan
& npx @command

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
