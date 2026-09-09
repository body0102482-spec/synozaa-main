param(
  [string]$HostName = '77.237.232.181',
  [int]$Port = 2222,
  [string]$User = 'root',
  [string]$Password = $env:SYNOZA_DEPLOY_PASSWORD,
  [string]$TarPath = (Join-Path $PSScriptRoot 'synoza-deploy.tar.gz'),
  [string]$AppDir = '/home/adminanmkavps/synoza.anmka.com',
  [string]$HostKey = 'SHA256:paT6RWZIBy7isEOnuevhUJt+pB06ZSrHgqCgNM2b8Cg'
)

$ErrorActionPreference = 'Stop'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'

if (-not $Password) {
  throw 'Password required: pass -Password "..." or set SYNOZA_DEPLOY_PASSWORD env var'
}
if (-not (Test-Path $TarPath)) { throw "Missing deploy package: $TarPath" }
if (-not (Test-Path $plink)) { throw 'PuTTY plink.exe not found' }

Write-Host "Uploading package..." -ForegroundColor Cyan
& $pscp -P $Port -hostkey $HostKey -pw $Password -batch $TarPath "${User}@${HostName}:/tmp/synoza-deploy.tar.gz"

$remoteCmd = @(
  'set -e'
  "APP=$AppDir"
  'mkdir -p "$APP"'
  'cd "$APP"'
  'rm -rf client server deploy start.sh ecosystem.config.cjs 2>/dev/null || true'
  'tar xzf /tmp/synoza-deploy.tar.gz'
  'cd server'
  'export NODE_ENV=production'
  'npm install --omit=dev'
  'npm install prisma @prisma/client tsx --no-save'
  'npx prisma generate'
  'npx prisma db push --accept-data-loss'
  'npx tsx src/seed.ts || true'
  'cd "$APP"'
  'pm2 delete synoza 2>/dev/null || true'
  'pm2 start ecosystem.config.cjs'
  'pm2 save'
  'nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true'
  'curl -s http://127.0.0.1:5099/api/ping || true'
  'pm2 list | grep synoza || true'
) -join '; '

Write-Host "Installing on server..." -ForegroundColor Cyan
& $plink -ssh "${User}@${HostName}" -P $Port -hostkey $HostKey -pw $Password -batch $remoteCmd
Write-Host 'Deploy completed.' -ForegroundColor Green
