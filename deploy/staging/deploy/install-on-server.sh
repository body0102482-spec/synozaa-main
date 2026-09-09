#!/bin/bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$APP_DIR/server"

echo "==> Synoza install in $APP_DIR"

cd "$SERVER_DIR"

if [ ! -f .env ]; then
  echo "ERROR: server/.env missing. Copy deploy/env.production.template to server/.env and edit values."
  exit 1
fi

export NODE_ENV=production

echo "==> Installing dependencies..."
npm install --omit=dev
npm install prisma @prisma/client tsx --no-save

echo "==> Prisma generate + database push..."
npx prisma generate
npx prisma db push --accept-data-loss

echo "==> Seeding database (first deploy)..."
npx tsx src/seed.ts || echo "Seed skipped or already done."

echo "==> Done. Start with:"
echo "    cd $SERVER_DIR && NODE_ENV=production node dist/index.js"
echo "Or configure cPanel Node.js App startup file: server/dist/index.js"
