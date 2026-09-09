param(
    [Parameter(Mandatory = $true)]
    [string]$RootPassword,

    [string]$MySqlBin = "C:\Program Files\MySQL\MySQL Server 9.0\bin\mysql.exe"
)

if (-not (Test-Path $MySqlBin)) {
    $MySqlBin = "C:\xampp\mysql\bin\mysql.exe"
}

if (-not (Test-Path $MySqlBin)) {
    Write-Error "MySQL client not found."
    exit 1
}

$sqlFile = Join-Path $PSScriptRoot "setup-mysql.sql"

Write-Host "Creating Synoza MySQL database..." -ForegroundColor Cyan
Write-Host "Using root password you provided." -ForegroundColor Gray

Get-Content $sqlFile -Raw | & $MySqlBin -u root -p"$RootPassword" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Error @"
Failed to create database.

Try one of these:
  1. Reset root password (Run as Admin):
     server\scripts\reset-mysql-root-admin.bat

  2. Use XAMPP MySQL instead (Run as Admin):
     server\scripts\use-xampp-mysql-admin.bat
     Then run: npm run db:setup-mysql -- -RootPassword ""

  3. Keep using SQLite (already configured in .env):
     npm run db:migrate
     npm run db:seed
"@
    exit 1
}

Write-Host ""
Write-Host "Database 'synoza' created!" -ForegroundColor Green
Write-Host ""
Write-Host "Next: switch server/.env to MySQL URL, then:" -ForegroundColor Yellow
Write-Host '  DATABASE_URL="mysql://synoza_user:Synoza%402026@localhost:3306/synoza"'
Write-Host "  (change schema.prisma provider to mysql)"
Write-Host "  npm run db:generate"
Write-Host "  npm run db:migrate"
Write-Host "  npm run db:seed"
