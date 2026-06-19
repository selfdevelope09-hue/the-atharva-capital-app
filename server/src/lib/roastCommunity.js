const crypto = require('crypto');
const { getPool } = require('../db/pool');

const ROAST_PNL_PER_MESSAGE = 1000;

function roastPointsForText(text) {
  const len = String(text || '').trim().length;
  return Math.max(1, 1 + Math.floor(len / 25));
}

function buildRoastClosedEntry(msgId) {
  const now = Date.now();
  return {
    closeId: `roast-${msgId}`,
    positionId: `roast-${msgId}`,
    symbol: 'ROAST',
    type: 'ROAST',
    status: 'CLOSED',
    realizedPnl: ROAST_PNL_PER_MESSAGE,
    grossPnl: ROAST_PNL_PER_MESSAGE,
    entryPrice: 0,
    exitPrice: 0,
    totalSize: 0,
    leverage: 1,
    closedAt: now,
    source: 'roast',
    label: 'by Roast'
  };
}

function parseClosedPositions(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function isRoomChatEnabled(roomId) {
  const { rows } = await getPool().query(
    `select chat_enabled from community_room_config where room_id = $1`,
    [roomId]
  );
  if (!rows[0]) return roomId === 'community' || roomId === 'roast';
  return rows[0].chat_enabled !== false;
}

async function applyRoastMessageReward(uid, msgId, text) {
  const points = roastPointsForText(text);
  const { rows: uRows } = await getPool().query(
    `select closed_positions, lifetime_realized_pnl, virtual_balance from users where uid = $1`,
    [uid]
  );
  const u = uRows[0];
  if (!u) return { points, pnlAdded: ROAST_PNL_PER_MESSAGE };

  const closed = parseClosedPositions(u.closed_positions);
  const entry = buildRoastClosedEntry(msgId);
  const nextClosed = [...closed, entry];
  const prevPnl = Number(u.lifetime_realized_pnl) || 0;
  const nextPnl = prevPnl + ROAST_PNL_PER_MESSAGE;
  const nextBalance = Math.max(0, Number(u.virtual_balance || 0) + ROAST_PNL_PER_MESSAGE);

  await getPool().query(
    `update users set
      lifetime_realized_pnl = $2,
      virtual_balance = $3,
      closed_positions = $4::jsonb,
      updated_at = now()
     where uid = $1`,
    [uid, nextPnl, nextBalance, JSON.stringify(nextClosed)]
  );

  await getPool().query(
    `insert into roast_leaderboard (uid, roast_points, message_count, roast_pnl, updated_at)
     values ($1, $2, 1, $3, now())
     on conflict (uid) do update set
       roast_points = roast_leaderboard.roast_points + excluded.roast_points,
       message_count = roast_leaderboard.message_count + 1,
       roast_pnl = roast_leaderboard.roast_pnl + excluded.roast_pnl,
       updated_at = now()`,
    [uid, points, ROAST_PNL_PER_MESSAGE]
  );

  return { points, pnlAdded: ROAST_PNL_PER_MESSAGE, lifetimeRealizedPnl: nextPnl };
}

async function queryRoastLeaderboard(limit = 25) {
  const lim = Math.min(100, Math.max(1, Number(limit) || 25));
  const { rows } = await getPool().query(
    `select r.uid, r.roast_points, r.message_count, r.roast_pnl, r.updated_at,
            u.name, u.photo_url, u.account_removed
     from roast_leaderboard r
     left join users u on u.uid = r.uid
     order by r.roast_points desc, r.message_count desc, r.updated_at desc
     limit $1`,
    [lim]
  );
  return rows.map((r, i) => ({
    rank: i + 1,
    uid: r.uid,
    name: r.name || 'Trader',
    photoURL: r.photo_url || '',
    accountRemoved: r.account_removed === true,
    roastPoints: Number(r.roast_points) || 0,
    messageCount: Number(r.message_count) || 0,
    roastPnl: Number(r.roast_pnl) || 0
  }));
}

async function setRoomChatEnabled(roomId, enabled) {
  await getPool().query(
    `insert into community_room_config (room_id, display_name, chat_enabled, updated_at)
     values ($1, $2, $3, now())
     on conflict (room_id) do update set chat_enabled = excluded.chat_enabled, updated_at = now()`,
    [roomId, roomId === 'roast' ? 'Roast Community' : 'AuronX Trade Community', !!enabled]
  );
}

async function hideCommunityMessage(messageId, hidden = true) {
  const { rowCount } = await getPool().query(
    `update community_messages set hidden = $2 where id = $1`,
    [messageId, !!hidden]
  );
  return rowCount > 0;
}

module.exports = {
  ROAST_PNL_PER_MESSAGE,
  roastPointsForText,
  buildRoastClosedEntry,
  isRoomChatEnabled,
  applyRoastMessageReward,
  queryRoastLeaderboard,
  setRoomChatEnabled,
  hideCommunityMessage
};
