const { Pool } = require('pg');
const { pgUrl } = require('../config/env');

let pool;

function getPool() {
  if (!pool) {
    if (!pgUrl) throw new Error('Missing PG_URL');
    pool = new Pool({
      connectionString: pgUrl,
      ssl: pgUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
      max: 20
    });
  }
  return pool;
}

module.exports = { getPool };
