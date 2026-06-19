const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { rowToClient, lastSeenFieldFromDb } = require('../../_lib/userRowMap');
const { sumClosedRealizedPnl } = require('../../_lib/virtualPerps.cjs');
const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const { getBlockedUidSet } = require('../../_lib/blockedUsers.cjs');
const { getFirestore } = require('../../_lib/firebaseAdmin');
const { ensureTradingSchema } = require('../../_lib/ensureTradingSchema.cjs');
const { isAppSettingsLeaderboardFrozen } = require('../../_lib/leaderboardCampaign.cjs');

const TOP = 180;

async function queryLeaderboardUsers(supa) {
  const selFull =
    'uid,email,name,photo_url,bio,virtual_balance,lifetime_realized_pnl,followers,following,watchlist,positions,closed_positions,presence_online,last_seen_at';
  const selMin =
    'uid,email,name,photo_url,bio,virtual_balance,lifetime_realized_pnl,followers,following,watchlist,presence_online,last_seen_at';
  for (const sel of [selFull, selMin]) {
    const [pl, bal] = await Promise.all([
      supa.from('users').select(sel).order('lifetime_realized_pnl', { ascending: false }).limit(TOP),
      supa.from('users').select(sel).order('virtual_balance', { ascending: false }).limit(TOP)
    ]);
    const errMsg = String(pl.error?.message || bal.error?.message || '');
    if (!pl.error && !bal.error) return { pl, bal };
    if (!/column|Could not find/i.test(errMsg)) throw pl.error || bal.error;
  }
  throw new Error('Leaderboard query failed — run supabase/trading_columns_migration.sql');
}

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    await verifyBearer(req);
    await ensureTradingSchema();
    const supa = getSupabaseAdmin();
    const { data: st } = await supa.from('app_settings').select('*').eq('id', 'global').maybeSingle();
    const blocked = await getBlockedUidSet();
    const filterBlocked = (rows) => rows.filter((r) => !blocked.has(String(r.uid || r.id || '')));

    if (isAppSettingsLeaderboardFrozen(st)) {
      const snap = st.leaderboard_snapshot;
      return json(res, 200, {
        ok: true,
        rows: filterBlocked(snap.rows),
        leaderboardFrozen: true,
        frozenMonthIst: snap.monthIst || st.frozen_month_ist,
        frozenMessage: st.frozen_message || snap.frozenMessage || ''
      });
    }
    const { pl, bal } = await queryLeaderboardUsers(supa);
    const byId = new Map();
    const mergeRow = (row) => {
      const c = rowToClient(row);
      const realizedPnlTotal = Math.max(
        Number(c.lifetimeRealizedPnl) || 0,
        sumClosedRealizedPnl(c.closedPositions)
      );
      byId.set(c.uid, {
        ...c,
        id: c.uid,
        realizedPnlTotal,
        lifetimeRealizedPnl: realizedPnlTotal
      });
    };
    (pl.data || []).forEach(mergeRow);
    (bal.data || []).forEach(mergeRow);
    const rows = filterBlocked(Array.from(byId.values()));
    rows.sort((a, b) => {
      const diff = b.realizedPnlTotal - a.realizedPnlTotal;
      if (diff !== 0) return diff;
      return (b.virtualBalance || 0) - (a.virtualBalance || 0);
    });

    const dbFs = (() => {
      try {
        return getFirestore();
      } catch {
        return null;
      }
    })();
    if (dbFs) {
      await Promise.all(
        rows.map(async (r) => {
          const uid = String(r.uid || '');
          if (!uid.startsWith('showcase__')) return;
          try {
            const fs = await dbFs.collection('users').doc(uid).get();
            if (!fs.exists) return;
            const d = fs.data();
            const off = d.showcasePresenceOfflineAt;
            let iso = null;
            if (off && typeof off.toDate === 'function') iso = off.toDate().toISOString();
            r.showcasePresenceOnline = d.showcasePresenceOnline === true;
            r.showcasePresenceExplicitOffline = d.showcasePresenceOnline === false;
            r.showcasePresenceOfflineAt = iso ? lastSeenFieldFromDb(iso) : r.showcasePresenceOfflineAt ?? null;
          } catch (_) {
            /* ignore */
          }
        })
      );
    }

    return json(res, 200, { ok: true, rows, leaderboardFrozen: false });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
