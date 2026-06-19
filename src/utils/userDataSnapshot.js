/** Cheap check before setState to avoid re-rendering the whole app on identical /api/data/me polls. */
export function userDataMeaningfullyChanged(prev, next) {
  if (prev === next) return false;
  if (!prev || !next) return true;
  if (prev.uid !== next.uid) return true;
  if (Number(prev.virtualBalance) !== Number(next.virtualBalance)) return true;
  if (Number(prev.lifetimeRealizedPnl) !== Number(next.lifetimeRealizedPnl)) return true;
  if (prev.isPaidMember !== next.isPaidMember) return true;
  if (prev.paidPlanType !== next.paidPlanType) return true;
  if (prev.dailyTradesDate !== next.dailyTradesDate) return true;
  if (Number(prev.dailyTradesCount) !== Number(next.dailyTradesCount)) return true;
  if (Number(prev.dailyAdTradeBonus) !== Number(next.dailyAdTradeBonus)) return true;
  const p0 = Array.isArray(prev.positions) ? prev.positions.length : 0;
  const p1 = Array.isArray(next.positions) ? next.positions.length : 0;
  if (p0 !== p1) return true;
  const c0 = Array.isArray(prev.closedPositions) ? prev.closedPositions.length : 0;
  const c1 = Array.isArray(next.closedPositions) ? next.closedPositions.length : 0;
  if (c0 !== c1) return true;
  if (prev.name !== next.name) return true;
  if (prev.photoURL !== next.photoURL) return true;
  return false;
}
