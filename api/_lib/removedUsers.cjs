const { getSupabaseAdmin } = require('./supabaseAdmin');

const REMOVED_USER_LABEL = 'Removed user';

async function isUidRemoved(uid) {
  if (!uid) return false;
  try {
    const supa = getSupabaseAdmin();
    const { data, error } = await supa
      .from('users')
      .select('account_removed')
      .eq('uid', String(uid))
      .maybeSingle();
    if (error) throw error;
    return data?.account_removed === true;
  } catch {
    return false;
  }
}

function rowLooksRemoved(row) {
  return row?.account_removed === true || row?.accountRemoved === true;
}

function withRemovedDisplay(clientRow) {
  if (!clientRow || !rowLooksRemoved(clientRow)) return clientRow;
  return { ...clientRow, accountRemoved: true, name: REMOVED_USER_LABEL };
}

module.exports = { REMOVED_USER_LABEL, isUidRemoved, rowLooksRemoved, withRemovedDisplay };
