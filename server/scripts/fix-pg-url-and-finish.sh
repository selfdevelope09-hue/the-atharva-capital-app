#!/usr/bin/env bash
set -euo pipefail
cd /opt/auron-realtime

node <<'NODE'
const fs = require('fs');
const path = require('path');
const envPath = path.join('/opt/auron-realtime', '.env');
let t = fs.readFileSync(envPath, 'utf8');
const m = t.match(/^PG_URL=postgresql:\/\/auronx:([^@]+)@/m);
if (!m) throw new Error('PG_URL not found');
const raw = decodeURIComponent(m[1]);
const fixed = 'PG_URL=postgresql://auronx:' + encodeURIComponent(raw) + '@127.0.0.1:5432/auronx';
t = t.replace(/^PG_URL=.*$/m, fixed);
fs.writeFileSync(envPath, t);
console.log('PG_URL fixed');
NODE

set -a
# shellcheck disable=SC1091
source .env
set +a

npm run db:schema

if ! command -v pm2 >/dev/null; then
  npm install -g pm2
fi

pm2 delete auron-realtime 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo '---HEALTH---'
curl -s http://127.0.0.1:3000/health || true
echo
echo '---TABLES---'
sudo -u postgres psql -d auronx -c '\dt'
echo '---PM2---'
pm2 list
