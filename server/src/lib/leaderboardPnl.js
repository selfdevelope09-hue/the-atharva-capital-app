const { getPool } = require('../db/pool');
const { sumClosedRealizedPnl } = require('./tradingMath');

/** SQL: sum realized P/L from users.closed_positions jsonb. */
const CLOSED_PNL_SUM_SQL = `(
  select coalesce(sum(
    coalesce(
      nullif(trim(e->>'realizedPnl'), '')::numeric,
      nullif(trim(e->>'realized_pnl'), '')::numeric,
      nullif(trim(e->>'grossPnl'), '')::numeric,
      0
    )
  ), 0)
  from jsonb_array_elements(
    case jsonb_typeof(u.closed_positions)
      when 'array' then u.closed_positions
      else '[]'::jsonb
    end
  ) e
)`;

const EFFECTIVE_PNL_SQL = `greatest(
  coalesce(u.lifetime_realized_pnl, 0),
  ${CLOSED_PNL_SUM_SQL},
  coalesce(ls.pnl, 0)
)`;

async function backfillLifetimeRealizedPnlFromClosed() {
  const sumExpr = CLOSED_PNL_SUM_SQL;
  const { rowCount } = await getPool().query(
    `update users u set
      lifetime_realized_pnl = greatest(coalesce(u.lifetime_realized_pnl, 0), ${sumExpr}),
      updated_at = now()
     where jsonb_typeof(u.closed_positions) = 'array'
       and jsonb_array_length(u.closed_positions) > 0
       and abs(coalesce(u.lifetime_realized_pnl, 0) - greatest(coalesce(u.lifetime_realized_pnl, 0), ${sumExpr})) > 0.000001`
  );
  return rowCount;
}

function effectivePnlFromRow(row) {
  const fromClosed = sumClosedRealizedPnl(
    Array.isArray(row.closed_positions) ? row.closed_positions : []
  );
  const stored = Number(row.lifetime_realized_pnl);
  const fromUser = Number.isFinite(stored) ? stored : 0;
  const showcase = Number(row.showcase_board_pnl) || 0;
  return Math.max(fromUser, fromClosed, showcase);
}

module.exports = {
  CLOSED_PNL_SUM_SQL,
  EFFECTIVE_PNL_SQL,
  backfillLifetimeRealizedPnlFromClosed,
  effectivePnlFromRow
};
