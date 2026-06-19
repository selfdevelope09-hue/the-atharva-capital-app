const {
  grossPnlUsdt,
  quantityFromNotional,
  sumClosedRealizedPnl,
  genPositionId
} = require('./virtualPerps.cjs');

/**
 * Month-end: close every open position at entry price (flat mark). No trading fees.
 * Returns DB-shaped patch for `users` row.
 */
function closeAllOpenPositionsForRow(row) {
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
    const closedPosition = {
      ...closedRow,
      exitPrice: exitPx,
      grossPnl: gross,
      openFee: 0,
      closeFee: 0,
      realizedPnl: finalPnl,
      closedAt: new Date().toISOString(),
      status: 'MONTH_END',
      closeReason: 'MONTH_END',
      closeId: genPositionId()
    };
    closedPositions.push(closedPosition);
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
