const { getPool } = require('../db/pool');

const REMOVED_USER_LABEL = 'Removed user';
const CACHE_MS = 30_000;
let cache = { at: 0, set: new Set() };

async function refreshRemovedCache() {
  const { rows } = await getPool().query(`select uid from users where account_removed = true`);
  cache = { at: Date.now(), set: new Set(rows.map((r) => String(r.uid))) };
  return cache.set;
}

async function getRemovedUidSet() {
  if (Date.now() - cache.at < CACHE_MS) return cache.set;
  return refreshRemovedCache();
}

async function isUidRemoved(uid) {
  if (!uid) return false;
  const set = await getRemovedUidSet();
  return set.has(String(uid));
}

function bustRemovedCache() {
  cache.at = 0;
}

function applyRemovedDisplay(row) {
  if (!row) return row;
  const removed = row.account_removed === true;
  if (!removed) return row;
  return { ...row, accountRemoved: true, name: REMOVED_USER_LABEL };
}

module.exports = {
  REMOVED_USER_LABEL,
  getRemovedUidSet,
  isUidRemoved,
  bustRemovedCache,
  refreshRemovedCache,
  applyRemovedDisplay
};
