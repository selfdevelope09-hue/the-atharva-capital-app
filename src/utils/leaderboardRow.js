import { resolveLeaderboardPnlTotal } from './positionUtils';

/** Ensure leaderboard row has realizedPnlTotal (BFF + cached snapshots). */
export function enrichLeaderboardRow(row) {
  if (!row || typeof row !== 'object') return row;
  const realizedPnlTotal = resolveLeaderboardPnlTotal(row);
  const uid = row.id || row.uid;
  return {
    ...row,
    id: uid,
    uid: uid || row.uid,
    realizedPnlTotal,
    lifetimeRealizedPnl: realizedPnlTotal
  };
}

export function enrichLeaderboardRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(enrichLeaderboardRow);
}
