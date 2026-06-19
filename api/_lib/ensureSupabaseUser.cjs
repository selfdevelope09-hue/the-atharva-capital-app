/** Ensure `public.users` row exists — seed from Firestore when migrating off Firebase reads. */
async function buildInsertSeededFromFirestore(uid, baseInsert) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return baseInsert;
  try {
    const { getFirestore } = require('./firebaseAdmin');
    const snap = await Promise.race([
      getFirestore().collection('users').doc(uid).get(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('firestore_seed_timeout')), 5000);
      })
    ]);
    if (!snap.exists) return baseInsert;
    const d = snap.data() || {};
    const next = { ...baseInsert };
    const vb = Number(d.virtualBalance);
    if (Number.isFinite(vb)) next.virtual_balance = vb;
    const lr = Number(d.lifetimeRealizedPnl);
    if (Number.isFinite(lr)) next.lifetime_realized_pnl = lr;
    if (Array.isArray(d.positions)) next.positions = d.positions;
    if (Array.isArray(d.closedPositions)) next.closed_positions = d.closedPositions;
    if (Array.isArray(d.watchlist)) next.watchlist = d.watchlist.map(String);
    if (Array.isArray(d.followers)) next.followers = d.followers.map(String);
    if (Array.isArray(d.following)) next.following = d.following.map(String);
    if (d.dailyTradesDate != null) next.daily_trades_date = String(d.dailyTradesDate).slice(0, 10);
    next.daily_trades_count = Number(d.dailyTradesCount) || 0;
    next.daily_ad_trade_bonus = Number(d.dailyAdTradeBonus) || 0;
    if (d.dailyTwelveRewardClaimedDate != null) {
      next.daily_twelve_reward_claimed_date = String(d.dailyTwelveRewardClaimedDate).slice(0, 10);
    }
    if (typeof d.name === 'string' && d.name.trim()) next.name = d.name.trim();
    if (typeof d.bio === 'string') next.bio = d.bio;
    if (typeof d.photoURL === 'string' && d.photoURL.trim()) next.photo_url = d.photoURL.trim();
    if (typeof d.email === 'string' && d.email.trim()) next.email = d.email.trim();
    return next;
  } catch {
    return baseInsert;
  }
}

async function ensureSupabaseUser(supa, decoded) {
  const uid = decoded.uid;
  const { data: existing, error: readErr } = await supa.from('users').select('*').eq('uid', uid).maybeSingle();
  if (readErr) throw readErr;
  if (existing) return existing;

  const baseInsert = {
    uid,
    email: decoded.email || '',
    name: decoded.name || (decoded.email || '').split('@')[0] || 'Trader',
    photo_url: decoded.picture || '',
    virtual_balance: 10000,
    lifetime_realized_pnl: 0,
    positions: [],
    closed_positions: [],
    watchlist: [],
    followers: [],
    following: [],
    daily_trades_date: null,
    daily_trades_count: 0,
    daily_ad_trade_bonus: 0,
    daily_twelve_reward_claimed_date: null
  };
  const insertRow = await buildInsertSeededFromFirestore(uid, baseInsert);
  const ins = await supa.from('users').insert(insertRow).select('*').single();
  if (ins.error) throw ins.error;
  return ins.data;
}

module.exports = { ensureSupabaseUser, buildInsertSeededFromFirestore };
