#!/bin/bash
set -e
APP=/home/adminanmkavps/synoza.anmka.com
mkdir -p "$APP"
cd "$APP"
rm -rf client server deploy start.sh ecosystem.config.cjs 2>/dev/null || true
tar xzf /tmp/synoza-deploy.tar.gz
cd server
export NODE_ENV=production
npm install --omit=dev
npm install prisma @prisma/client tsx --no-save
npx prisma generate
npx prisma db push --accept-data-loss
npx tsx src/seed.ts || true
cd "$APP"
pm2 delete synoza 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
curl -s http://127.0.0.1:5099/api/ping || true
pm2 list | grep synoza || true
