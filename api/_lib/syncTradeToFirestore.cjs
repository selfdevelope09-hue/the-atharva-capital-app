const { getFirestore } = require('./firebaseAdmin');

function tradePatchFromSupabaseRow(row) {
  if (!row || typeof row !== 'object') return null;
  const patch = {};
  if (row.virtual_balance != null) patch.virtualBalance = Number(row.virtual_balance);
  if (row.positions != null) patch.positions = row.positions;
  if (row.closed_positions != null) patch.closedPositions = row.closed_positions;
  if (row.lifetime_realized_pnl != null) patch.lifetimeRealizedPnl = Number(row.lifetime_realized_pnl);
  if (row.daily_trades_date != null) patch.dailyTradesDate = String(row.daily_trades_date).slice(0, 10);
  if (row.daily_trades_count != null) patch.dailyTradesCount = Number(row.daily_trades_count) || 0;
  if (row.daily_ad_trade_bonus != null) patch.dailyAdTradeBonus = Number(row.daily_ad_trade_bonus) || 0;
  if (row.daily_twelve_reward_claimed_date != null) {
    patch.dailyTwelveRewardClaimedDate = String(row.daily_twelve_reward_claimed_date).slice(0, 10);
  }
  return Object.keys(patch).length ? patch : null;
}

/**
 * After Supabase open/close, merge trading fields into Firestore (profile/social untouched).
 * Default is disabled to keep DO/Postgres as the only live trading source.
 * Set SUPABASE_SYNC_FIRESTORE_TRADE=true only when explicit Firestore mirroring is needed.
 */
async function syncTradeToFirestore(uid, supabaseRow) {
  const raw = String(process.env.SUPABASE_SYNC_FIRESTORE_TRADE || '').toLowerCase().trim();
  const enabled = raw === 'true' || raw === '1' || raw === 'yes';
  if (!enabled) return;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return;
  const patch = tradePatchFromSupabaseRow(supabaseRow);
  if (!patch) return;
  const run = async () => {
    const db = getFirestore();
    await db
      .collection('users')
      .doc(String(uid))
      .set(patch, { merge: true });
  };
  try {
    await Promise.race([
      run(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('firestore_sync_timeout')), 8000);
      })
    ]);
  } catch (e) {
    console.warn('[syncTradeToFirestore]', String(uid), e?.message || e);
  }
}

/** Return HTTP response immediately; sync Firestore in background (dashboard/leaderboard update via onSnapshot). */
function scheduleSyncTradeToFirestore(uid, supabaseRow) {
  void syncTradeToFirestore(uid, supabaseRow);
}

module.exports = { syncTradeToFirestore, scheduleSyncTradeToFirestore, tradePatchFromSupabaseRow };
