#!/bin/bash
set -euo pipefail
cd /opt/auron-realtime
set -a
[ -f .env ] && . ./.env
set +a

node server/scripts/apply-chat-schema.js 2>/dev/null || node -e "
const { Pool } = require('pg');
const fs = require('fs');
(async () => {
  const pgUrl = process.env.PG_URL || process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString: pgUrl,
    ssl: pgUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
  });
  await pool.query(fs.readFileSync('sql/patch-users-source-updated.sql', 'utf8'));
  await pool.query(fs.readFileSync('sql/chat-schema.sql', 'utf8'));
  console.log('schema_ok');
  await pool.end();
})();
"

rm -f .migration-checkpoint.json
nohup node scripts/migrate-firestore-to-postgres.js \
  --collections=users,payments,dmThreads \
  --batch=150 \
  > /tmp/fs-migrate-full.log 2>&1 &
echo "migration_pid=$!"
sleep 3
tail -20 /tmp/fs-migrate-full.log
