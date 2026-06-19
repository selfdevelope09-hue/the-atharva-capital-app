#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getPool } = require('../src/db/pool');
const { ensureAppCredentials } = require('../src/lib/appLogin');

async function main() {
  const { rows } = await getPool().query(
    `select uid from users
     where coalesce(is_showcase_profile, false) = false
       and (app_login_id is null or app_login_id = '' or app_password_hash is null or app_password_hash = '')
     order by created_at asc`
  );
  let created = 0;
  for (const row of rows) {
    const result = await ensureAppCredentials(row.uid);
    if (result) created += 1;
  }
  console.log(`app-login backfill: ${created} users got new AuronX ID (${rows.length} checked).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
