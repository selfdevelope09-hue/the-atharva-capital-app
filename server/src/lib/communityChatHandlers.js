const crypto = require('crypto');
const { getPool } = require('../db/pool');
const { messageRowToClient } = require('./userRowMap');
const { resolveChatActor } = require('./chatActor');
const { isPlatformAdminUid } = require('./platformAdminPg');
const { isUidRemoved } = require('./removedUsers');
const {
  applyRoastMessageReward,
  isRoomChatEnabled,
  queryRoastLeaderboard,
  ROAST_PNL_PER_MESSAGE,
  roastPointsForText,
  getRoomChatStatus
} = require('./roastCommunity');

function normalizeRoomId(raw) {
  const id = String(raw || 'community').trim().toLowerCase();
  return id === 'roast' ? 'roast' : 'community';
}

async function getCommunityUnread(req, res) {
  try {
    const uid = req.user.uid;
    const roomId = normalizeRoomId(req.query.room);
    const { rows: stateRows } = await getPool().query(
      `select last_seen_at from community_read_state where uid = $1 and room_id = $2`,
      [uid, roomId]
    );
    const lastSeen = stateRows[0]?.last_seen_at ? new Date(stateRows[0].last_seen_at) : new Date(0);

    const { rows: countRows } = await getPool().query(
      `select count(*)::int as n from community_messages
       where room_id = $3 and created_at > $2 and from_uid <> $1 and coalesce(hidden, false) = false`,
      [uid, lastSeen, roomId]
    );
    const unreadCount = Number(countRows[0]?.n) || 0;

    const { rows: lastRows } = await getPool().query(
      `select id, from_uid, from_name, text, image_url, file_url, file_name, created_at
       from community_messages
       where room_id = $2 and from_uid <> $1 and coalesce(hidden, false) = false
       order by created_at desc
       limit 1`,
      [uid, roomId]
    );
    const last = lastRows[0];
    res.json({
      ok: true,
      room: roomId,
      unreadCount,
      lastMessage: last
        ? {
            id: last.id,
            fromUid: last.from_uid,
            fromName: last.from_name || 'Trader',
            text: last.text || '',
            imageUrl: last.image_url || '',
            fileUrl: last.file_url || '',
            fileName: last.file_name || '',
            createdAt: last.created_at ? new Date(last.created_at).toISOString() : null
          }
        : null
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

async function getCommunityMessages(req, res) {
  try {
    const roomId = normalizeRoomId(req.query.room);
    const lim = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100));
    const beforeRaw = String(req.query.before || '').trim();
    let q = `select * from community_messages where room_id = $1 and coalesce(hidden, false) = false`;
    const params = [roomId];
    if (beforeRaw) {
      q += ` and created_at < $${params.length + 1}::timestamptz`;
      params.push(beforeRaw);
    }
    q += ` order by created_at desc limit $${params.length + 1}`;
    params.push(lim);
    const { rows } = await getPool().query(q, params);
    const chronological = rows.slice().reverse();
    const msgIds = chronological.map((r) => r.id);
    let readsByMessage = {};
    if (msgIds.length) {
      const { rows: readRows } = await getPool().query(
        `select message_id, uid, from_name from community_message_reads where message_id = any($1::text[])`,
        [msgIds]
      );
      readRows.forEach((r) => {
        if (!readsByMessage[r.message_id]) readsByMessage[r.message_id] = [];
        readsByMessage[r.message_id].push({ uid: r.uid, fromName: r.from_name || 'Trader' });
      });
    }
    res.json({
      ok: true,
      room: roomId,
      messages: chronological.map(messageRowToClient),
      readsByMessage,
      hasMore: rows.length >= lim
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

async function postCommunityMarkRead(req, res) {
  try {
    const actorUid = await resolveChatActor(req);
    const fromName = String(req.body?.fromName || 'Trader').trim() || 'Trader';
    const roomId = normalizeRoomId(req.body?.room || req.query?.room);
    await getPool().query(
      `insert into community_read_state (uid, room_id, from_name, last_seen_at)
       values ($1, $2, $3, now())
       on conflict (uid, room_id) do update set from_name = excluded.from_name, last_seen_at = now()`,
      [actorUid, roomId, fromName]
    );
    await getPool().query(
      `insert into community_message_reads (message_id, uid, from_name, read_at)
       select id, $1, $2, now() from community_messages where room_id = $3
       on conflict (message_id, uid) do update set read_at = now(), from_name = excluded.from_name`,
      [actorUid, fromName, roomId]
    );
    res.json({ ok: true, room: roomId });
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message });
  }
}

async function postCommunitySend(req, res) {
  try {
    const actorUid = await resolveChatActor(req);
    const roomId = normalizeRoomId(req.body?.room || req.query?.room);
    if (!(await isRoomChatEnabled(roomId))) {
      return res.status(403).json({ ok: false, error: 'This group chat is temporarily disabled by admin.' });
    }
    if (await isUidRemoved(actorUid)) {
      return res.status(403).json({
        ok: false,
        error: 'Account removed',
        accountRemoved: true,
        platformBlocked: true
      });
    }
    const text = String(req.body?.text || '').trim();
    const imageUrl = String(req.body?.imageUrl || '').trim();
    const fileUrl = String(req.body?.fileUrl || '').trim();
    const fileName = String(req.body?.fileName || '').trim();
    const mediaKind = String(req.body?.mediaKind || '').trim();
    const fromName = String(req.body?.fromName || 'Trader');
    if (!text && !imageUrl && !fileUrl) {
      return res.status(400).json({ ok: false, error: 'Empty message' });
    }
    const msgId = crypto.randomUUID();
    await getPool().query(
      `insert into community_messages (id, room_id, from_uid, from_name, text, image_url, file_url, file_name, media_kind)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        msgId,
        roomId,
        actorUid,
        fromName,
        text || '',
        imageUrl || null,
        fileUrl || null,
        fileName || null,
        mediaKind || null
      ]
    );
    await getPool().query(
      `insert into community_message_reads (message_id, uid, from_name, read_at)
       values ($1, $2, $3, now())
       on conflict (message_id, uid) do update set read_at = now(), from_name = excluded.from_name`,
      [msgId, actorUid, fromName]
    );

    let roastReward = null;
    if (roomId === 'roast') {
      roastReward = await applyRoastMessageReward(actorUid, msgId, text);
    }

    const { rows: savedRows } = await getPool().query(`select * from community_messages where id = $1`, [msgId]);
    res.json({
      ok: true,
      room: roomId,
      message: messageRowToClient(savedRows[0]),
      roastReward: roastReward
        ? {
            points: roastReward.points,
            pnlAdded: roastReward.pnlAdded,
            lifetimeRealizedPnl: roastReward.lifetimeRealizedPnl
          }
        : null
    });
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message });
  }
}

async function postCommunityDelete(req, res) {
  try {
    if (!(await isPlatformAdminUid(req.user.uid))) {
      return res.status(403).json({ ok: false, error: 'Admin only' });
    }
    const messageId = String(req.body?.messageId || '').trim();
    const softHide = req.body?.hide === true || req.body?.disable === true;
    if (!messageId) return res.status(400).json({ ok: false, error: 'Missing messageId' });
    if (softHide) {
      const { rowCount } = await getPool().query(
        `update community_messages set hidden = true where id = $1`,
        [messageId]
      );
      if (!rowCount) return res.status(404).json({ ok: false, error: 'Message not found' });
      return res.json({ ok: true, messageId, hidden: true });
    }
    const { rowCount } = await getPool().query(`delete from community_messages where id = $1`, [messageId]);
    if (!rowCount) return res.status(404).json({ ok: false, error: 'Message not found' });
    res.json({ ok: true, messageId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

async function getCommunityRoomStatus(req, res) {
  try {
    const roomId = normalizeRoomId(req.query.room);
    const status = await getRoomChatStatus(roomId);
    res.json({ ok: true, ...status, chatEnabled: status.chatEnabled });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

async function getRoastLeaderboard(req, res) {
  try {
    const lim = parseInt(String(req.query.limit || '20'), 10) || 20;
    const rows = await queryRoastLeaderboard(lim);
    res.json({
      ok: true,
      rows,
      pnlPerMessage: ROAST_PNL_PER_MESSAGE,
      pointsHelp: 'Roast points = 1 base + 1 per 25 characters in your message. Each roast message adds $1,000 to main leaderboard P/L.'
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

module.exports = {
  normalizeRoomId,
  getCommunityUnread,
  getCommunityMessages,
  postCommunityMarkRead,
  postCommunitySend,
  postCommunityDelete,
  getCommunityRoomStatus,
  getRoastLeaderboard,
  roastPointsForText,
  ROAST_PNL_PER_MESSAGE
};
