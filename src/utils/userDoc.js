import { normalizeOpenPosition, sumClosedRealizedPnl } from './positionUtils';

/** JSONB / legacy map → position list (dashboard + merge). */
export function coerceJsonArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const vals = Object.values(v);
    if (vals.length && vals.some((x) => x && typeof x === 'object')) return vals;
  }
  return [];
}

/** Firestore followers/following must be string[]; normalize legacy map shapes. */
export const toUidList = (v) => {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'object') return Object.keys(v).filter((k) => k && !String(k).startsWith('__'));
  return [];
};

/** Firestore users/ doc → app shape (followers/following always string[] from DB, not cache). */
export const normalizeUserDocData = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const data = { ...raw };
  data.positions = coerceJsonArray(data.positions)
    .map((p) => normalizeOpenPosition(p))
    .filter(Boolean);
  data.closedPositions = coerceJsonArray(data.closedPositions);
  data.watchlist = data.watchlist || [];
  data.followers = toUidList(data.followers);
  data.following = toUidList(data.following);
  if (data.dailyTradesDate != null) data.dailyTradesDate = String(data.dailyTradesDate).slice(0, 10);
  else data.dailyTradesDate = '';
  const dtc = Number(data.dailyTradesCount);
  data.dailyTradesCount = Number.isFinite(dtc) && dtc >= 0 ? dtc : 0;
  const dab = Number(data.dailyAdTradeBonus);
  data.dailyAdTradeBonus = Number.isFinite(dab) && dab >= 0 ? dab : 0;
  if (data.dailyTwelveRewardClaimedDate != null) {
    data.dailyTwelveRewardClaimedDate = String(data.dailyTwelveRewardClaimedDate).slice(0, 10);
  } else data.dailyTwelveRewardClaimedDate = '';
  const vb = Number(data.virtualBalance ?? data.virtual_balance);
  if (Number.isFinite(vb)) data.virtualBalance = vb;
  const lrp = Number(data.lifetimeRealizedPnl ?? data.lifetime_realized_pnl);
  data.lifetimeRealizedPnl = Number.isFinite(lrp)
    ? lrp
    : sumClosedRealizedPnl(data.closedPositions);
  const photo = data.photoURL || data.photo_url || data.photoUrl;
  if (photo) data.photoURL = String(photo).trim();
  return data;
};

/** Supabase row has real trading usage (not just the default empty row from GET /api/data/me). */
export function bffUserHasTradeActivity(b) {
  if (!b || typeof b !== 'object') return false;
  const p = Array.isArray(b.positions) ? b.positions.length : 0;
  const c = Array.isArray(b.closedPositions) ? b.closedPositions.length : 0;
  const d = Number(b.dailyTradesCount) || 0;
  return p + c > 0 || d > 0;
}

/**
 * Firestore = social/profile; Supabase = wallet when user has traded on BFF. Avoids overwriting
 * a real Firestore balance with a fresh default Supabase row until there is trade activity.
 */
export function mergeFirestoreUserWithSupabaseTrade(fsRaw, bffRaw) {
  const fs = fsRaw ? normalizeUserDocData(fsRaw) : null;
  const bff = bffRaw ? normalizeUserDocData(bffRaw) : null;
  if (!fs) return bff;
  if (!bff) return fs;
  if (!bffUserHasTradeActivity(bff)) return fs;
  const bffBal = Number(bff.virtualBalance);
  const useBffWallet = Number.isFinite(bffBal) && bffBal > 0;
  return {
    ...fs,
    ...(useBffWallet ? { virtualBalance: bffBal } : {}),
    positions: bff.positions?.length ? bff.positions : fs.positions,
    closedPositions: bff.closedPositions?.length ? bff.closedPositions : fs.closedPositions,
    lifetimeRealizedPnl:
      Number.isFinite(Number(bff.lifetimeRealizedPnl)) ? bff.lifetimeRealizedPnl : fs.lifetimeRealizedPnl,
    dailyTradesDate: bff.dailyTradesDate ?? fs.dailyTradesDate,
    dailyTradesCount:
      bff.dailyTradesCount != null && bff.dailyTradesCount !== ''
        ? Number(bff.dailyTradesCount)
        : fs.dailyTradesCount,
    dailyAdTradeBonus:
      bff.dailyAdTradeBonus != null && bff.dailyAdTradeBonus !== ''
        ? Number(bff.dailyAdTradeBonus)
        : fs.dailyAdTradeBonus,
    dailyTwelveRewardClaimedDate: bff.dailyTwelveRewardClaimedDate ?? fs.dailyTwelveRewardClaimedDate
  };
}
