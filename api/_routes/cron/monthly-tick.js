const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { getFirestore } = require('../../_lib/firebaseAdmin');
const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const { rowToClient } = require('../../_lib/userRowMap');
const { sumClosedRealizedPnl } = require('../../_lib/virtualPerps.cjs');
const { closeAllOpenPositionsForRow } = require('../../_lib/bulkCloseUserPositions.cjs');

function istParts() {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return { y, m, d };
}

function monthKey(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.authorization || '';
  if (!secret || auth !== `Bearer ${secret}`) return json(res, 401, { ok: false, error: 'Unauthorized' });

  const { y, m, d } = istParts();
  const mk = monthKey(y, m);
  const lastDayOfMonth = new Date(y, m, 0).getDate();
  const supa = getSupabaseAdmin();

  if (d === 1) {
    await supa
      .from('app_settings')
      .update({
        leaderboard_frozen: false,
        frozen_month_ist: null,
        leaderboard_snapshot: null,
        frozen_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'global');
    try {
      const db = getFirestore();
      await db.collection('config').doc('leaderboardFreeze').set({
        frozen: false,
        monthIst: null,
        snapshot: null,
        message: null,
        updatedAt: new Date().toISOString()
      });
    } catch (_) {
      /* optional */
    }
    return json(res, 200, { ok: true, action: 'unfreeze', monthKey: mk });
  }

  if (d !== lastDayOfMonth) {
    return json(res, 200, { ok: true, action: 'noop', reason: 'not_last_ist_day' });
  }

  const { data: stRow } = await supa.from('app_settings').select('last_settled_month_ist').eq('id', 'global').maybeSingle();
  if (stRow?.last_settled_month_ist === mk) {
    return json(res, 200, { ok: true, action: 'already_settled', monthKey: mk });
  }

  let processed = 0;
  let from = 0;
  const page = 100;
  for (;;) {
    const { data: batch, error } = await supa
      .from('users')
      .select('uid,positions,virtual_balance,closed_positions,lifetime_realized_pnl')
      .range(from, from + page - 1);
    if (error) throw error;
    if (!batch?.length) break;
    for (const row of batch) {
      if (!Array.isArray(row.positions) || !row.positions.length) continue;
      const patch = closeAllOpenPositionsForRow(row);
      const up = await supa.from('users').update(patch).eq('uid', row.uid);
      if (!up.error) processed += 1;
    }
    if (batch.length < page) break;
    from += page;
  }

  const sel =
    'uid,email,name,photo_url,bio,virtual_balance,lifetime_realized_pnl,followers,following,watchlist,positions,closed_positions';
  const top = await supa.from('users').select(sel).order('lifetime_realized_pnl', { ascending: false }).limit(5);
  if (top.error) throw top.error;
  const snapRows = (top.data || []).map((row, i) => {
    const c = rowToClient(row);
    const fromClosed = sumClosedRealizedPnl(c.closedPositions);
    const stored =
      typeof c.lifetimeRealizedPnl === 'number' && !Number.isNaN(c.lifetimeRealizedPnl)
        ? c.lifetimeRealizedPnl
        : null;
    const realizedPnlTotal = stored != null ? Math.max(stored, fromClosed) : fromClosed;
    return {
      id: c.uid,
      uid: c.uid,
      name: c.name,
      photoURL: c.photoURL,
      bio: c.bio,
      virtualBalance: c.virtualBalance,
      realizedPnlTotal,
      rank: i + 1
    };
  });

  const frozenMessage = `Monthly tally finalized for ${mk} (IST). Leaderboard locked until the 1st of next month.`;
  const snapshot = { monthIst: mk, rows: snapRows, settledAt: new Date().toISOString(), frozenMessage };

  await supa
    .from('app_settings')
    .update({
      leaderboard_frozen: true,
      frozen_month_ist: mk,
      leaderboard_snapshot: snapshot,
      last_settled_month_ist: mk,
      frozen_message: frozenMessage,
      updated_at: new Date().toISOString()
    })
    .eq('id', 'global');

  try {
    const db = getFirestore();
    await db.collection('config').doc('leaderboardFreeze').set({
      frozen: true,
      monthIst: mk,
      snapshot: snapRows,
      message: frozenMessage,
      updatedAt: new Date().toISOString()
    });
  } catch (_) {
    /* optional */
  }

  return json(res, 200, {
    ok: true,
    action: 'settled',
    monthKey: mk,
    positionsClosedUsers: processed,
    podium: snapRows.length
  });
};
