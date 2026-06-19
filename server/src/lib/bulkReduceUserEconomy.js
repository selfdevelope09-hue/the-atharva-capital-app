const { getPool } = require('../db/pool');

const ALLOWED_PERCENTS = [25, 50, 75, 90];

function parsePercent(raw) {
  const n = Number(raw);
  if (!ALLOWED_PERCENTS.includes(n)) {
    throw new Error(`percent must be one of: ${ALLOWED_PERCENTS.join(', ')}`);
  }
  return n;
}

function scaleClosedPositions(arr, factor) {
  if (!Array.isArray(arr)) return [];
  return arr.map((p) => {
    if (!p || typeof p !== 'object') return p;
    const next = { ...p };
    for (const key of ['realizedPnl', 'realized_pnl', 'grossPnl', 'gross_pnl']) {
      if (next[key] != null && next[key] !== '') {
        const v = Number(next[key]);
        if (Number.isFinite(v)) next[key] = Math.round(v * factor * 100) / 100;
      }
    }
    return next;
  });
}

/**
 * Reduce all active users' virtual balance + leaderboard P/L by the same percentage.
 * @param {number} percentReduce e.g. 25 → keep 75% of balance and P/L
 */
async function bulkReduceAllUsersEconomy(percentReduce) {
  const pct = parsePercent(percentReduce);
  const factor = 1 - pct / 100;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const bulkUsers = await client.query(
      `update users set
        virtual_balance = greatest(0, round(coalesce(virtual_balance, 0) * $1, 2)),
        lifetime_realized_pnl = round(coalesce(lifetime_realized_pnl, 0) * $1, 2),
        updated_at = now()
       where coalesce(account_removed, false) = false
       returning uid`,
      [factor]
    );
    const usersUpdated = bulkUsers.rowCount || 0;

    const { rows: withClosed } = await client.query(
      `select uid, closed_positions from users
       where coalesce(account_removed, false) = false
         and jsonb_typeof(closed_positions) = 'array'
         and jsonb_array_length(closed_positions) > 0`
    );
    for (const row of withClosed) {
      const closed = scaleClosedPositions(
        Array.isArray(row.closed_positions)
          ? row.closed_positions
          : row.closed_positions && typeof row.closed_positions === 'object'
            ? row.closed_positions
            : []
      );
      await client.query(`update users set closed_positions = $2::jsonb where uid = $1`, [
        row.uid,
        JSON.stringify(closed)
      ]);
    }

    const showcaseRes = await client.query(
      `update leaderboard_showcase set
        pnl = round(coalesce(pnl, 0) * $1, 2),
        updated_at = now()
       returning id`,
      [factor]
    );

    let roastRowsUpdated = 0;
    try {
      const roastRes = await client.query(
        `update roast_leaderboard set
          roast_pnl = round(coalesce(roast_pnl, 0) * $1, 2),
          updated_at = now()`,
        [factor]
      );
      roastRowsUpdated = roastRes.rowCount || 0;
    } catch {
      roastRowsUpdated = 0;
    }

    await client.query('COMMIT');
    return {
      percentReduced: pct,
      keepFactor: factor,
      usersUpdated,
      showcaseRowsUpdated: showcaseRes.rowCount || 0,
      roastRowsUpdated
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  ALLOWED_PERCENTS,
  bulkReduceAllUsersEconomy
};
