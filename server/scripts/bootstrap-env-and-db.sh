#!/usr/bin/env bash
# Run on DigitalOcean: cd /opt/auron-realtime && bash scripts/bootstrap-env-and-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "==> Auron realtime bootstrap in $ROOT"

if ! command -v psql >/dev/null 2>&1; then
  echo "Installing PostgreSQL..."
  apt-get update -y
  apt-get install -y postgresql postgresql-contrib
fi
systemctl enable --now postgresql

export PG_PASS="${PG_PASS:-$(openssl rand -base64 24 | tr -d '\n')}"
echo "Postgres user auronx password: $PG_PASS"

sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='auronx'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER auronx WITH PASSWORD '${PG_PASS}';"

sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='auronx'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE auronx OWNER auronx;"

if [ ! -f "$ROOT/serviceAccount.json" ]; then
  echo "ERROR: $ROOT/serviceAccount.json missing. Upload it first."
  exit 1
fi

export PG_PASS
node -e "
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const sa = require(path.join(root, 'serviceAccount.json'));
const pgPass = process.env.PG_PASS;
if (!pgPass) throw new Error('PG_PASS missing');

const lines = [
  'PORT=3000',
  'NODE_ENV=production',
  'PG_URL=postgresql://auronx:' + encodeURIComponent(pgPass) + '@127.0.0.1:5432/auronx',
  'FIREBASE_SERVICE_ACCOUNT_JSON=' + JSON.stringify(sa),
  'CORS_ORIGINS=https://www.theatharvacapital.com,https://theatharvacapital.com,https://localhost,capacitor://localhost',
  'BLOCKED_UIDS='
];
fs.writeFileSync(path.join(root, '.env'), lines.join('\n') + '\n', { mode: 0o600 });
console.log('Wrote .env (chmod 600)');
"

node -e "require('dotenv').config(); if(!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('Firebase JSON missing'); console.log('Firebase JSON OK');"

if [ ! -d node_modules ]; then
  echo "==> npm install..."
  npm install
fi

echo "==> Applying schema..."
set -a
# shellcheck disable=SC1091
source .env
set +a
npm run db:schema

echo "==> Tables:"
sudo -u postgres psql -d auronx -c '\dt'

echo "==> Bootstrap complete."
