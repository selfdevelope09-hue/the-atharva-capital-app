const {
  grossPnlUsdt,
  quantityFromNotional,
  sumClosedRealizedPnl,
  genPositionId
} = require('./tradingMath');

/**
 * Campaign / month-end: close every open position at entry (flat mark).
 * Returns DB-shaped patch for `users` row.
 */
function closeAllOpenPositionsForRow(row, closedAtIso = new Date().toISOString()) {
  let vbal = Number(row.virtual_balance);
  let positions = Array.isArray(row.positions) ? row.positions : [];
  let closedPositions = Array.isArray(row.closed_positions) ? [...row.closed_positions] : [];
  if (!positions.length) {
    return {
      virtual_balance: vbal,
      positions: [],
      closed_positions: closedPositions,
      lifetime_realized_pnl: sumClosedRealizedPnl(closedPositions)
    };
  }
  for (const closedRow of positions) {
    const entry = parseFloat(closedRow.entryPrice);
    const exitPx = entry;
    const qty =
      Number.isFinite(parseFloat(closedRow.quantity)) && parseFloat(closedRow.quantity) > 0
        ? parseFloat(closedRow.quantity)
        : quantityFromNotional(parseFloat(closedRow.totalSize), entry);
    const gross = grossPnlUsdt(closedRow.type, entry, exitPx, qty);
    const storedOpen = Number.isFinite(parseFloat(closedRow.openFee))
      ? Math.max(0, parseFloat(closedRow.openFee))
      : 0;
    const margin = parseFloat(closedRow.margin) || 0;
    const finalPnl = gross;
    closedPositions.push({
      ...closedRow,
      exitPrice: exitPx,
      grossPnl: gross,
      openFee: 0,
      closeFee: 0,
      realizedPnl: finalPnl,
      closedAt: closedAtIso,
      status: 'CAMPAIGN_END',
      closeReason: 'CAMPAIGN_END',
      closeId: genPositionId()
    });
    vbal += margin + finalPnl + storedOpen;
  }
  const lifetimeRealized = sumClosedRealizedPnl(closedPositions);
  return {
    virtual_balance: vbal,
    positions: [],
    closed_positions: closedPositions,
    lifetime_realized_pnl: lifetimeRealized
  };
}

module.exports = { closeAllOpenPositionsForRow };
