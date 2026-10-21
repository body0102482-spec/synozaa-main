# Build Synoza for production upload to synoza.anmka.com
param(
  [string]$OutputZip = "synoza-deploy.zip"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
  $Stage = Join-Path $Root "deploy\staging"
  if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }

Write-Host "Building Synoza..." -ForegroundColor Cyan

Push-Location $Root
try {
  npm run build --prefix client
  npm run build --prefix server

  Write-Host "Staging deploy package..." -ForegroundColor Cyan
  New-Item -ItemType Directory -Force -Path $Stage | Out-Null
  New-Item -ItemType Directory -Force -Path "$Stage/client/dist" | Out-Null
  New-Item -ItemType Directory -Force -Path "$Stage/client/public/exam" | Out-Null
  New-Item -ItemType Directory -Force -Path "$Stage/server/dist" | Out-Null
  New-Item -ItemType Directory -Force -Path "$Stage/server/prisma" | Out-Null
  New-Item -ItemType Directory -Force -Path "$Stage/server/src/data" | Out-Null
  New-Item -ItemType Directory -Force -Path "$Stage/deploy" | Out-Null
  New-Item -ItemType Directory -Force -Path "$Stage/deploy/migrations" | Out-Null

  Copy-Item -Recurse "$Root/client/dist/*" "$Stage/client/dist/"
  Copy-Item -Recurse "$Root/client/public/exam/*" "$Stage/client/public/exam/"
  Copy-Item -Recurse "$Root/server/dist/*" "$Stage/server/dist/"
  Copy-Item "$Root/server/package.json" "$Stage/server/"
  Copy-Item "$Root/server/package-lock.json" "$Stage/server/" -ErrorAction SilentlyContinue
  Copy-Item "$Root/server/src/seed.ts" "$Stage/server/src/"
  Copy-Item -Recurse "$Root/server/src/data/*" "$Stage/server/src/data/"
  Copy-Item "$Root/server/prisma/schema.mysql.prisma" "$Stage/server/prisma/schema.prisma"
  Copy-Item "$Root/deploy/install-on-server.sh" "$Stage/deploy/"
  # Ensure Unix line endings for bash on Linux
  $installSh = Join-Path $Stage "deploy/install-on-server.sh"
  $content = (Get-Content $installSh -Raw) -replace "`r`n", "`n"
  [System.IO.File]::WriteAllText($installSh, $content)
  Copy-Item "$Root/deploy/env.production.template" "$Stage/deploy/"
  Copy-Item "$Root/deploy/migrations/*.sql" "$Stage/deploy/migrations/"
  # Optional local env template; production restores server/.env from live backup during push-update
  if (Test-Path "$Root/deploy/server.env.production") {
    Copy-Item "$Root/deploy/server.env.production" "$Stage/server/.env"
  }
  Copy-Item "$Root/deploy/ecosystem.config.cjs" "$Stage/"

  @"
#!/bin/bash
cd "`$(dirname `$0`)/server"
NODE_ENV=production node dist/index.js
"@ | Set-Content -Path "$Stage/start.sh" -Encoding UTF8

  $zipPath = Join-Path $Root "deploy\synoza-deploy.zip"
  $tarPath = Join-Path $Root "deploy\synoza-deploy.tar.gz"
  if (Test-Path $tarPath) { Remove-Item $tarPath -Force }
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

  $gitTar = "C:\Program Files\Git\bin\bash.exe"
  if (Test-Path $gitTar) {
    & $gitTar -lc "cd deploy/staging && tar czf ../synoza-deploy.tar.gz ."
  }
  Compress-Archive -Path "$Stage\*" -DestinationPath $zipPath -Force

  Write-Host ""
  Write-Host "Deploy package ready:" -ForegroundColor Green
  Write-Host "  ZIP: $zipPath"
  Write-Host "  TAR: $tarPath"
  Write-Host ""
  Write-Host "Next steps:" -ForegroundColor Yellow
  Write-Host "  1. Upload and extract to ~/synoza.anmka.com on the server"
  Write-Host "  2. Copy deploy/env.production.template -> server/.env (fill MySQL + secrets)"
  Write-Host "  3. Run: bash deploy/install-on-server.sh"
  Write-Host "  4. Point cPanel Node.js app to server/dist/index.js OR run bash start.sh"
}
finally {
  Pop-Location
}
