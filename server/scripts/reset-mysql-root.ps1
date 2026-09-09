# Reset MySQL root password (local dev) — run as Administrator
# Sets root password to EMPTY so phpMyAdmin can login without password

$ErrorActionPreference = "Stop"
$MyIni = "C:\ProgramData\MySQL\MySQL Server 9.0\my.ini"
$MySqlBin = "C:\Program Files\MySQL\MySQL Server 9.0\bin"
$ServiceName = "MySQL90"

if (-not (Test-Path $MyIni)) {
    Write-Error "my.ini not found at $MyIni"
    exit 1
}

Write-Host "Stopping $ServiceName..." -ForegroundColor Yellow
Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# Backup my.ini
$backup = "$MyIni.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $MyIni $backup
Write-Host "Backup: $backup"

$content = Get-Content $MyIni -Raw
if ($content -notmatch 'skip-grant-tables') {
    $content = $content -replace '(\[mysqld\]\r?\n)', "`$1skip-grant-tables`r`n"
    Set-Content -Path $MyIni -Value $content -NoNewline
    Write-Host "Added skip-grant-tables" -ForegroundColor Cyan
}

Write-Host "Starting $ServiceName..." -ForegroundColor Yellow
Start-Service -Name $ServiceName
Start-Sleep -Seconds 5

$mysql = Join-Path $MySqlBin "mysql.exe"
$sql = @"
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED BY '';
FLUSH PRIVILEGES;
"@

Write-Host "Resetting root password to EMPTY..." -ForegroundColor Cyan
$sql | & $mysql -u root --skip-password 2>&1

# Remove skip-grant-tables
$content = Get-Content $MyIni -Raw
$content = $content -replace 'skip-grant-tables\r?\n', ''
Set-Content -Path $MyIni -Value $content -NoNewline

Write-Host "Restarting $ServiceName..." -ForegroundColor Yellow
Restart-Service -Name $ServiceName -Force
Start-Sleep -Seconds 4

# Test connection
& $mysql -u root -e "SELECT 'OK' AS status;" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS! MySQL root has NO password." -ForegroundColor Green
    Write-Host "phpMyAdmin: user=root, password=(leave empty)" -ForegroundColor Green
} else {
    Write-Host "Empty password failed, trying password 'root'..." -ForegroundColor Yellow
    & $mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'root'; FLUSH PRIVILEGES;" 2>&1
    Write-Host "Login: root / root" -ForegroundColor Green
}
