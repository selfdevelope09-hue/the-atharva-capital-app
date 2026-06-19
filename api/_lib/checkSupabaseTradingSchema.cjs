const { getSupabaseAdmin } = require('./supabaseAdmin');

/** Returns true when `users.positions` column is readable. */
async function hasSupabaseTradingColumns() {
  try {
    const supa = getSupabaseAdmin();
    const { error } = await supa.from('users').select('uid,positions,virtual_balance').limit(1);
    if (error) {
      const msg = String(error.message || '');
      if (/column|Could not find/i.test(msg)) return false;
      throw error;
    }
    return true;
  } catch {
    return false;
  }
}

module.exports = { hasSupabaseTradingColumns };
