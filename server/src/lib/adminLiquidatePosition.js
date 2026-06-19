const { getPool } = require('../db/pool');
const { getUserByUid, updateUserOptimistic } = require('../db/usersRepo');
const {
  grossPnlUsdt,
  quantityFromNotional,
  liquidationPrice,
  findPositionIndex,
  genPositionId,
  sumClosedRealizedPnl,
  nextLifetimeRealizedPnl
} = require('./tradingMath');

function coercePositions(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Object.values(v);
  return [];
}

/**
 * Admin-only: close one open position as a natural liquidation (liq price, full margin loss).
 */
async function adminLiquidateUserPosition(targetUid, uiIndex, positionHint = {}) {
  const uid = String(targetUid || '').trim();
  if (!uid) return { ok: false, error: 'Missing targetUid' };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await getUserByUid(uid);
    if (!row) return { ok: false, error: 'User not found' };

    const vbal = Number(row.virtual_balance);
    const currentPositions = coercePositions(row.positions);
    const matchIdx = findPositionIndex(currentPositions, positionHint, Number(uiIndex));
    if (matchIdx < 0) return { ok: false, error: 'Position not found' };

    const openRow = currentPositions[matchIdx];
    const entry = parseFloat(openRow.entryPrice);
    const lev = parseFloat(openRow.leverage) || 1;
    const type = openRow.type === 'SHORT' ? 'SHORT' : 'LONG';
    const liqPx = liquidationPrice(type, entry, lev);
    const exitPx = Number.isFinite(liqPx) ? liqPx : entry;
    const qty =
      Number.isFinite(parseFloat(openRow.quantity)) && parseFloat(openRow.quantity) > 0
        ? parseFloat(openRow.quantity)
        : quantityFromNotional(parseFloat(openRow.totalSize), entry);
    const gross = grossPnlUsdt(type, entry, exitPx, qty);
    const storedOpen = Number.isFinite(parseFloat(openRow.openFee)) ? Math.max(0, parseFloat(openRow.openFee)) : 0;
    const margin = parseFloat(openRow.margin) || 0;
    const closeReason = 'LIQUIDATED';
    const finalPnl = -Math.max(0, margin);
    const balanceCredit = margin + finalPnl;

    const newPositions = currentPositions.filter((_, i) => i !== matchIdx);
    let closedPositions = coercePositions(row.closed_positions);
    const closedPosition = {
      ...openRow,
      exitPrice: exitPx,
      grossPnl: gross,
      openFee: storedOpen,
      closeFee: 0,
      realizedPnl: finalPnl,
      closedAt: new Date().toISOString(),
      status: closeReason,
      closeReason,
      closeId: genPositionId()
    };
    const nextClosed = [...closedPositions, closedPosition];
    const nextBal = vbal + balanceCredit;
    const lifetimeRealized = nextLifetimeRealizedPnl(row.lifetime_realized_pnl, nextClosed, finalPnl);

    const updated = await updateUserOptimistic(uid, vbal, {
      virtual_balance: nextBal,
      positions: newPositions,
      closed_positions: nextClosed,
      lifetime_realized_pnl: lifetimeRealized
    });

    if (updated) {
      getPool()
        .query(
          `update users set creds_liquidations_count = coalesce(creds_liquidations_count, 0) + 1, updated_at = now() where uid = $1`,
          [uid]
        )
        .catch(() => {});
      return {
        ok: true,
        targetUid: uid,
        finalPnl,
        exitPrice: exitPx,
        symbol: openRow.symbol,
        type,
        positionsRemaining: newPositions.length
      };
    }
    await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
  }

  return { ok: false, error: 'Liquidation conflict. Try again.' };
}

module.exports = { adminLiquidateUserPosition };
