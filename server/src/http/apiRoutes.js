const express = require('express');
const { getPool } = require('../db/pool');
const { ensureUserFromFirebase, getUserByUid, updateUserOptimistic } = require('../db/usersRepo');
const { rowToClient, threadRowToClient, messageRowToClient } = require('../lib/userRowMap');
const { sumClosedRealizedPnl } = require('../lib/tradingMath');
const { tradingDayKey, yesterdayTradingDayKey, MAX_AD_TRADE_BONUS_SLOTS } = require('../lib/tradingDay');
const { buildCredsProfileFromRow } = require('../lib/credsCalculator');
const { openTrade, closeTrade } = require('../services/trading/engine');
const { verifyHttpAuth } = require('../middleware/httpAuth');
const { saveBuffer, readBase64Payload } = require('../lib/mediaUpload');
const { isPlatformAdminUid } = require('../lib/platformAdminPg');
const { syncUserChatFromFirestore } = require('../lib/chatFirestoreSync');
const { resolveChatActor, threadIncludesUid } = require('../lib/chatActor');
const { resolveTradeActorUid } = require('../lib/tradeActor');
const { ensureAppCredentials, createCustomTokenForAppLogin, changeAppPassword, changeAppLoginId } = require('../lib/appLogin');
const { validateDisplayName } = require('../lib/displayName');
const {
  loadCampaignConfig,
  getWinnerForUid,
  maybeAutoFinalizeLeaderboardCampaign,
  isLeaderboardCampaignFrozen,
  ensureActiveLeaderboardCampaign
} = require('../lib/leaderboardCampaign');
const { queryLiveLeaderboardRows } = require('../lib/leaderboardQuery');
const { isUidRemoved } = require('../lib/removedUsers');
const {
  getCommunityUnread,
  getCommunityMessages,
  postCommunityMarkRead,
  postCommunitySend,
  postCommunityDelete,
  getCommunityRoomStatus,
  getRoastLeaderboard
} = require('../lib/communityChatHandlers');

const RESET_PRODUCT_CODE = 'account_reset_50';
const RESET_START_BALANCE = 10000;
/** Must match client ChatScreen COMMUNITY_CACHE_KEY — community uploads skip dm_threads check. */
const COMMUNITY_CHAT_THREAD_ID = 'community__traders';

const publicRouter = express.Router();

publicRouter.post('/api/data/app-login', async (req, res) => {
  try {
    const loginId = String(req.body?.loginId || req.body?.id || '').trim();
    const password = String(req.body?.password || '');
    if (!loginId || !password) {
      return res.status(400).json({ ok: false, error: 'Enter AuronX ID and password' });
    }
    const { customToken } = await createCustomTokenForAppLogin(loginId, password);
    res.json({ ok: true, customToken });
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message || 'Login failed' });
  }
});

const router = express.Router();
router.use(verifyHttpAuth);

router.post('/api/data/change-app-password', async (req, res) => {
  try {
    await changeAppPassword(
      req.user.uid,
      String(req.body?.currentPassword || ''),
      String(req.body?.newPassword || '')
    );
    res.json({ ok: true });
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message || 'Could not change password' });
  }
});

router.post('/api/data/change-app-login', async (req, res) => {
  try {
    const result = await changeAppLoginId(
      req.user.uid,
      String(req.body?.currentPassword || ''),
      String(req.body?.newLoginId || req.body?.loginId || '')
    );
    res.json({ ok: true, ...result });
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message || 'Could not change AuronX ID' });
  }
});

function dmChannelId(uidA, uidB) {
  const [x, y] = [uidA, uidB].sort();
  return `${x}__${y}`;
}

router.get('/api/data/me', async (req, res) => {
  try {
    let row = await getUserByUid(req.user.uid);
    if (!row) row = await ensureUserFromFirebase(req.user);
    const created = await ensureAppCredentials(req.user.uid);
    if (created) {
      row = await getUserByUid(req.user.uid);
    }
    const client = rowToClient(row);
    if (created) {
      client.appLoginId = created.loginId;
      client.appLoginPassword = created.password;
      client.appPasswordMustChange = true;
    }
    const campaign = await loadCampaignConfig();
    const leaderboardWinner = getWinnerForUid(campaign, req.user.uid);
    res.json({ ok: true, user: client, leaderboardWinner: leaderboardWinner || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

publicRouter.get('/api/data/leaderboard-winners', async (_req, res) => {
  try {
    const campaign = await loadCampaignConfig();
    if (!campaign?.finalized) {
      return res.json({ ok: true, finalized: false, winners: [], endsLabel: campaign?.endsLabel || null });
    }
    res.json({
      ok: true,
      finalized: true,
      campaignKey: campaign.campaignKey,
      finalizedAt: campaign.finalizedAt,
      endsLabel: campaign.endsLabel,
      frozenMessage: campaign.frozenMessage,
      winners: campaign.winners || []
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.patch('/api/data/me', async (req, res) => {
  try {
    const body = req.body || {};
    let targetUid = req.user.uid;
    const forUid = String(body.forUid || body.asUid || '').trim();
    if (forUid && forUid !== targetUid) {
      if (!forUid.startsWith('showcase__') || !(await isPlatformAdminUid(req.user.uid))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      targetUid = forUid;
    }
    const row = await getUserByUid(targetUid);
    if (!row) return res.status(404).json({ ok: false, error: 'User not found' });
    const patch = {};
    if (typeof body.name === 'string') {
      const v = validateDisplayName(body.name);
      if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
      patch.name = v.name;
    }
    if (typeof body.bio === 'string') patch.bio = body.bio;
    if (typeof body.photoURL === 'string') patch.photo_url = body.photoURL;
    if (Array.isArray(body.watchlist)) patch.watchlist = body.watchlist.map(String);
    const { rows } = await getPool().query(
      `update users set
        name = coalesce($2, name),
        bio = coalesce($3, bio),
        photo_url = coalesce($4, photo_url),
        watchlist = coalesce($5, watchlist),
        updated_at = now()
      where uid = $1
      returning uid, email, name, photo_url, bio, virtual_balance, lifetime_realized_pnl,
        followers, following, watchlist, presence_online, last_seen_at,
        positions, closed_positions, portfolio,
        daily_trades_date, daily_trades_count, daily_ad_trade_bonus, daily_twelve_reward_claimed_date`,
      [
        targetUid,
        patch.name ?? null,
        patch.bio ?? null,
        patch.photo_url ?? null,
        patch.watchlist ?? null
      ]
    );
    if (targetUid.startsWith('showcase__') && patch.name) {
      await getPool().query(
        `update leaderboard_showcase set display_name = $2, updated_at = now() where profile_uid = $1`,
        [targetUid, patch.name]
      );
    }
    res.json({ ok: true, user: rowToClient(rows[0]) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/data/presence', async (req, res) => {
  try {
    const online = !!(req.body && req.body.online);
    await getPool().query(
      `update users set presence_online = $2, last_seen_at = now(), updated_at = now() where uid = $1`,
      [req.user.uid, online]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/data/presence-minute', async (req, res) => {
  try {
    const today = tradingDayKey();
    const yesterday = yesterdayTradingDayKey();
    const requestedUid = String((req.body && req.body.forUid) || '').trim();
    let uid = req.user.uid;
    if (requestedUid && requestedUid !== uid) {
      const canCredit =
        requestedUid.startsWith('showcase__') && (await isPlatformAdminUid(req.user.uid));
      if (canCredit) uid = requestedUid;
    }
    await getPool().query(
      `update users set
        total_minutes_online = coalesce(total_minutes_online, 0) + 1,
        creds_active_days = case
          when coalesce(creds_last_active_date, '') = $2 then coalesce(creds_active_days, 0)
          else coalesce(creds_active_days, 0) + 1
        end,
        creds_streak_days = case
          when coalesce(creds_last_active_date, '') = $2 then coalesce(creds_streak_days, 0)
          when coalesce(creds_last_active_date, '') = $3 then coalesce(creds_streak_days, 0) + 1
          else 1
        end,
        creds_last_active_date = $2,
        updated_at = now()
      where uid = $1`,
      [uid, today, yesterday]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const CREDS_PAGE_SIZE = 20;

async function fetchAllUsersForCreds() {
  const all = [];
  const batch = 400;
  let offset = 0;
  for (;;) {
    const { rows } = await getPool().query(
      `select uid, name, photo_url, positions, closed_positions,
        coalesce(total_minutes_online, 0) as total_minutes_online,
        coalesce(creds_active_days, 0) as creds_active_days,
        coalesce(creds_streak_days, 0) as creds_streak_days,
        coalesce(creds_liquidations_count, 0) as creds_liquidations_count,
        coalesce(creds_paid_bonus, 0) as creds_paid_bonus,
        coalesce(is_showcase_profile, false) as is_showcase_profile,
        coalesce(is_paid_member, false) as is_paid_member,
        paid_plan_type
       from users
       order by uid asc
       offset $1 limit $2`,
      [offset, batch]
    );
    all.push(...rows);
    if (rows.length < batch) break;
    offset += batch;
  }
  return all;
}

router.get('/api/data/creds-ratings', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const dbRows = await fetchAllUsersForCreds();
    const ranked = dbRows
      .map(buildCredsProfileFromRow)
      .sort((a, b) => b.credsScore - a.credsScore || String(a.name).localeCompare(String(b.name)));
    const totalUsers = ranked.length;
    const totalPages = Math.max(1, Math.ceil(totalUsers / CREDS_PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * CREDS_PAGE_SIZE;
    const rows = ranked.slice(start, start + CREDS_PAGE_SIZE).map((r, i) => ({
      ...r,
      rank: start + i + 1
    }));

    let me = null;
    const requestedUid = String(req.query.forUid || '').trim();
    let myUid = req.user?.uid;
    if (requestedUid && requestedUid !== myUid) {
      const canViewAs =
        requestedUid.startsWith('showcase__') && (await isPlatformAdminUid(req.user.uid));
      if (canViewAs) myUid = requestedUid;
    }
    if (myUid) {
      const idx = ranked.findIndex((r) => r.uid === myUid);
      if (idx >= 0) {
        me = { ...ranked[idx], rank: idx + 1 };
      } else {
        const row = await getUserByUid(myUid);
        if (row) {
          const profile = buildCredsProfileFromRow(row);
          me = { ...profile, rank: null };
        }
      }
    }

    res.json({
      ok: true,
      rows,
      page: safePage,
      pageSize: CREDS_PAGE_SIZE,
      totalPages,
      totalUsers,
      me
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/api/data/user-public', async (req, res) => {
  try {
    const uid = String(req.query.uid || '').trim();
    if (!uid) return res.status(400).json({ ok: false, error: 'Missing uid' });
    const row = await getUserByUid(uid);
    if (!row) return res.json({ ok: true, user: null });
    res.json({ ok: true, user: rowToClient(row) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/api/data/premium-members', async (req, res) => {
  try {
    const { rows } = await getPool().query(
      `select uid, name, photo_url, paid_plan_type, paid_member_until,
        coalesce(is_showcase_profile, false) as is_showcase_profile
       from users
       where is_paid_member = true
         and paid_plan_type in ('basic', 'pro', 'ultimate_pro')
         and (paid_member_until is null or paid_member_until > now())
       order by
         case paid_plan_type
           when 'ultimate_pro' then 0
           when 'pro' then 1
           when 'basic' then 2
           else 3
         end,
         name asc
       limit 120`
    );
    res.json({
      ok: true,
      members: rows.map((r) => ({
        uid: r.uid,
        name: r.name || 'Trader',
        photoURL: r.photo_url || '',
        paidPlanType: r.paid_plan_type,
        paidMemberUntil: r.paid_member_until ? new Date(r.paid_member_until).toISOString() : null
      }))
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/data/users-bulk', async (req, res) => {
  try {
    const uids = Array.isArray(req.body?.uids) ? req.body.uids.map(String).filter(Boolean) : [];
    if (!uids.length) return res.json({ ok: true, users: [] });
    const { rows } = await getPool().query(
      `select uid, email, name, photo_url, bio, virtual_balance, lifetime_realized_pnl,
        followers, following, watchlist, presence_online, last_seen_at,
        positions, closed_positions, portfolio,
        daily_trades_date, daily_trades_count, daily_ad_trade_bonus, daily_twelve_reward_claimed_date,
        coalesce(is_showcase_profile, false) as is_showcase_profile,
        coalesce(is_paid_member, false) as is_paid_member,
        paid_plan_type, paid_member_until,
        coalesce(creds_paid_bonus, 0) as creds_paid_bonus,
        showcase_presence_online, showcase_presence_offline_at,
        coalesce(account_removed, false) as account_removed
       from users where uid = any($1::text[])`,
      [uids]
    );
    res.json({ ok: true, users: rows.map(rowToClient) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/api/data/leaderboard', async (req, res) => {
  try {
    await maybeAutoFinalizeLeaderboardCampaign().catch((e) => {
      console.warn('leaderboard auto-finalize', e?.message || e);
    });
    await ensureActiveLeaderboardCampaign();
    const campaign = await loadCampaignConfig();
    const rows = await queryLiveLeaderboardRows(500);
    const frozen = isLeaderboardCampaignFrozen(campaign);
    res.json({
      ok: true,
      rows,
      leaderboardFrozen: frozen,
      frozenMonthIst: campaign?.snapshot?.monthIst || campaign?.campaignKey || null,
      frozenMessage: frozen ? campaign.frozenMessage || campaign?.snapshot?.frozenMessage || '' : '',
      winners: campaign?.winners || []
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/api/chat/threads', async (req, res) => {
  try {
    const actorUid = await resolveChatActor(req);
    const syncFirestore =
      req.query.syncFirestore === '1' ||
      req.query.syncFirestore === 'true' ||
      req.query.hydrate === '1';
    let firestoreSynced = null;
    if (syncFirestore) {
      try {
        firestoreSynced = await syncUserChatFromFirestore(actorUid);
      } catch (syncErr) {
        console.warn('chat firestore sync', syncErr?.message || syncErr);
      }
    }
    const { rows } = await getPool().query(
      `select * from dm_threads where $1 = any(participants) order by updated_at desc`,
      [actorUid]
    );
    res.json({ ok: true, threads: rows.map(threadRowToClient), firestoreSynced });
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message });
  }
});

router.post('/api/chat/ensure', async (req, res) => {
  try {
    const actorUid = await resolveChatActor(req);
    const otherUid = String(req.body?.otherUid || '').trim();
    const meName = String(req.body?.meName || 'Trader');
    const otherName = String(req.body?.otherName || 'Trader');
    if (!otherUid || otherUid === actorUid) {
      return res.status(400).json({ ok: false, error: 'Invalid otherUid' });
    }
    const id = dmChannelId(actorUid, otherUid);
    const { rows: prevRows } = await getPool().query(`select * from dm_threads where id = $1`, [id]);
    const prev = prevRows[0];
    const unreadByUser = { ...(prev?.unread_by_user || {}) };
    unreadByUser[actorUid] = unreadByUser[actorUid] ?? 0;
    unreadByUser[otherUid] = unreadByUser[otherUid] ?? 0;
    await getPool().query(
      `insert into dm_threads (id, participants, names, unread_by_user, last_seen_at, updated_at)
       values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, now())
       on conflict (id) do update set
         names = dm_threads.names || excluded.names,
         updated_at = now()`,
      [
        id,
        [actorUid, otherUid].sort(),
        JSON.stringify({ [actorUid]: meName, [otherUid]: otherName }),
        JSON.stringify(unreadByUser),
        JSON.stringify(prev?.last_seen_at || {})
      ]
    );
    res.json({ ok: true, threadId: id });
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message });
  }
});

router.get('/api/chat/community/unread', getCommunityUnread);
router.get('/api/chat/community-unread', getCommunityUnread);

router.get('/api/chat/community/messages', getCommunityMessages);
router.get('/api/chat/community-messages', getCommunityMessages);

router.post('/api/chat/community/mark-read', postCommunityMarkRead);
router.post('/api/chat/community-mark-read', postCommunityMarkRead);

router.post('/api/chat/community/send', postCommunitySend);
router.post('/api/chat/community-send', postCommunitySend);

router.post('/api/chat/community/delete', postCommunityDelete);
router.post('/api/chat/community-delete', postCommunityDelete);

router.get('/api/chat/community-room-status', getCommunityRoomStatus);
router.get('/api/chat/community/room-status', getCommunityRoomStatus);

router.get('/api/chat/roast-leaderboard', getRoastLeaderboard);
router.get('/api/chat/roast/leaderboard', getRoastLeaderboard);

router.get('/api/chat/messages', async (req, res) => {
  try {
    const actorUid = await resolveChatActor(req);
    const threadId = String(req.query.threadId || '').trim();
    if (!threadId) return res.status(400).json({ ok: false, error: 'Missing threadId' });
    const { rows: tRows } = await getPool().query(
      `select participants, last_seen_at from dm_threads where id = $1`,
      [threadId]
    );
    const t = tRows[0];
    if (!t) {
      return res.json({ ok: true, messages: [], hasMore: false });
    }
    if (!threadIncludesUid(t, actorUid)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    const otherUid = (t.participants || []).find((p) => p !== actorUid) || '';
    const peerSeenRaw = otherUid ? (t.last_seen_at || {})[otherUid] : null;
    let peerLastSeenAt = null;
    if (peerSeenRaw) {
      let ms = 0;
      if (typeof peerSeenRaw === 'string') ms = Date.parse(peerSeenRaw);
      else if (typeof peerSeenRaw === 'number' && Number.isFinite(peerSeenRaw)) ms = peerSeenRaw;
      else if (peerSeenRaw && typeof peerSeenRaw === 'object' && typeof peerSeenRaw.seconds === 'number') {
        ms = peerSeenRaw.seconds * 1000 + Math.floor((peerSeenRaw.nanoseconds || 0) / 1e6);
      } else {
        ms = new Date(peerSeenRaw).getTime();
      }
      if (Number.isFinite(ms) && ms > 0) {
        peerLastSeenAt = { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 };
      }
    }
    const lim = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '45'), 10) || 45));
    const beforeRaw = String(req.query.before || '').trim();
    let q = `select * from dm_messages where thread_id = $1`;
    const params = [threadId];
    if (beforeRaw) {
      q += ` and created_at < $2::timestamptz`;
      params.push(beforeRaw);
    }
    q += ` order by created_at desc limit $${params.length + 1}`;
    params.push(lim);
    const { rows } = await getPool().query(q, params);
    const chronological = rows.slice().reverse();
    res.json({
      ok: true,
      messages: chronological.map(messageRowToClient),
      hasMore: chronological.length >= lim,
      peerLastSeenAt
    });
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message });
  }
});

router.post('/api/upload/media', async (req, res) => {
  try {
    const actorUid = await resolveChatActor(req);
    const kind = String(req.body?.kind || '').trim();
    const threadId = String(req.body?.threadId || '').trim();
    const fileName = String(req.body?.fileName || 'file').trim();
    const { contentType, buffer } = readBase64Payload(req.body || {});
    if (!buffer?.length) return res.status(400).json({ ok: false, error: 'Empty file' });
    if (kind === 'chat') {
      if (!threadId) return res.status(400).json({ ok: false, error: 'Missing threadId' });
      const isCommunity = threadId === COMMUNITY_CHAT_THREAD_ID;
      if (!isCommunity) {
        const { rows: tRows } = await getPool().query(`select participants from dm_threads where id = $1`, [
          threadId
        ]);
        if (!threadIncludesUid(tRows[0], actorUid)) {
          return res.status(403).json({ ok: false, error: 'Forbidden' });
        }
      }
    } else if (kind !== 'profile') {
      return res.status(400).json({ ok: false, error: 'Invalid kind' });
    }
    const saved = saveBuffer({
      uid: actorUid,
      kind,
      buffer,
      contentType,
      fileName,
      threadId,
      req
    });
    if (kind === 'profile') {
      await getPool().query(`update users set photo_url = $2, updated_at = now() where uid = $1`, [
        actorUid,
        saved.url
      ]);
    }
    res.json({
      ok: true,
      url: saved.url,
      mediaKind: saved.mediaKind,
      fileName: saved.fileName
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || 'Upload failed' });
  }
});

router.post('/api/chat/send', async (req, res) => {
  try {
    const actorUid = await resolveChatActor(req);
    if (await isUidRemoved(actorUid)) {
      return res.status(403).json({
        ok: false,
        error: 'Account removed',
        accountRemoved: true,
        platformBlocked: true
      });
    }
    const threadId = String(req.body?.threadId || '').trim();
    const text = String(req.body?.text || '').trim();
    const imageUrl = String(req.body?.imageUrl || '').trim();
    const fileUrl = String(req.body?.fileUrl || '').trim();
    const fileName = String(req.body?.fileName || '').trim();
    const mediaKind = String(req.body?.mediaKind || '').trim();
    const activeOtherId = String(req.body?.activeOtherId || '').trim();
    const replyTo = req.body?.replyTo && typeof req.body.replyTo === 'object' ? req.body.replyTo : null;
    const fromName = String(req.body?.fromName || 'Trader');
    if (!threadId || !activeOtherId || (!text && !imageUrl && !fileUrl)) {
      return res.status(400).json({ ok: false, error: 'Missing fields' });
    }
    const { rows: tRows } = await getPool().query(`select * from dm_threads where id = $1`, [threadId]);
    const t = tRows[0];
    if (!threadIncludesUid(t, actorUid) || !t.participants.includes(activeOtherId)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    const msgId = require('crypto').randomUUID();
    await getPool().query(
      `insert into dm_messages (id, thread_id, from_uid, from_name, text, image_url, file_url, file_name, media_kind, reply_to)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [
        msgId,
        threadId,
        actorUid,
        fromName,
        text || '',
        imageUrl || null,
        fileUrl || null,
        fileName || null,
        mediaKind || null,
        replyTo ? JSON.stringify(replyTo) : null
      ]
    );
    const unread = { ...(t.unread_by_user || {}) };
    unread[actorUid] = 0;
    if (activeOtherId && activeOtherId !== actorUid) {
      unread[activeOtherId] = Number(unread[activeOtherId] || 0) + 1;
    }
    let preview = text.slice(0, 120);
    if (imageUrl) preview = text ? text.slice(0, 100) : '📷 Photo';
    else if (fileUrl) preview = text ? text.slice(0, 100) : fileName ? `📎 ${fileName.slice(0, 40)}` : '📎 File';
    await getPool().query(
      `update dm_threads set last_preview = $2, last_from_name = $3, last_from_uid = $4, unread_by_user = $5::jsonb, updated_at = now() where id = $1`,
      [threadId, preview, fromName, actorUid, JSON.stringify(unread)]
    );
    if (activeOtherId.startsWith('showcase__')) {
      const peerShowcaseName = String(req.body?.peerShowcaseName || 'Showcase').trim();
      try {
        await getPool().query(
          `insert into admin_chat_logs (id, thread_id, peer_showcase_id, peer_showcase_name, from_uid, from_name, text, image_url)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            require('crypto').randomUUID(),
            threadId,
            activeOtherId,
            peerShowcaseName,
            actorUid,
            fromName,
            text || (imageUrl ? '[Photo]' : ''),
            imageUrl || null
          ]
        );
      } catch (logErr) {
        console.error('admin_chat_logs', logErr?.message);
      }
    }
    const { rows: savedRows } = await getPool().query(`select * from dm_messages where id = $1`, [msgId]);
    const { rows: threadRows } = await getPool().query(`select * from dm_threads where id = $1`, [threadId]);
    res.json({
      ok: true,
      message: messageRowToClient(savedRows[0]),
      thread: threadRows[0] ? threadRowToClient(threadRows[0]) : null
    });
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message });
  }
});

router.post('/api/chat/mark-read', async (req, res) => {
  try {
    const threadId = String(req.body?.threadId || '').trim();
    if (!threadId) return res.status(400).json({ ok: false, error: 'Missing threadId' });
    const { rows: tRows } = await getPool().query(`select * from dm_threads where id = $1`, [threadId]);
    const t = tRows[0];
    let readerUid = req.user.uid;
    const asUid = String(req.body?.asUid || '').trim();
    if (asUid && asUid !== readerUid) {
      if (!asUid.startsWith('showcase__') || !(await isPlatformAdminUid(req.user.uid))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      readerUid = asUid;
    }
    if (!t?.participants?.includes(readerUid)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    if (readerUid.startsWith('showcase__') && !(await isPlatformAdminUid(req.user.uid))) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    const unread = { ...(t.unread_by_user || {}) };
    unread[readerUid] = 0;
    const lastSeenAt = { ...(t.last_seen_at || {}) };
    if (!readerUid.startsWith('showcase__') || asUid) {
      lastSeenAt[readerUid] = new Date().toISOString();
    }
    await getPool().query(
      `update dm_threads set unread_by_user = $2::jsonb, last_seen_at = $3::jsonb, updated_at = now() where id = $1`,
      [threadId, JSON.stringify(unread), JSON.stringify(lastSeenAt)]
    );
    try {
      const { initFirebase } = require('../lib/firebaseAdmin');
      const admin = require('firebase-admin');
      const db = initFirebase().firestore();
      await db
        .collection('dmThreads')
        .doc(threadId)
        .set(
          {
            unreadByUser: unread,
            lastSeenAt: { [readerUid]: lastSeenAt[readerUid] || new Date().toISOString() },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
    } catch (fsErr) {
      console.warn('mark-read firestore sync', fsErr?.message || fsErr);
    }
    const { rows: savedThread } = await getPool().query(`select * from dm_threads where id = $1`, [threadId]);
    res.json({
      ok: true,
      threadId,
      unreadByUser: unread,
      thread: savedThread[0] ? threadRowToClient(savedThread[0]) : null
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/trade/open', async (req, res) => {
  try {
    const tradeUid = await resolveTradeActorUid(req.user.uid, req.body || {});
    const result = await openTrade(tradeUid, req.user, req.body || {});
    if (!result.ok) return res.status(400).json(result);
    res.json({
      ok: true,
      twelveTradeBonusUsd: result.twelveTradeBonusUsd,
      dailyOpensToday: result.dailyOpensToday,
      tradeUid
    });
  } catch (e) {
    console.error('[trade:open]', req.user?.uid, e?.message || e);
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message || 'Trade failed' });
  }
});

router.post('/api/trade/close', async (req, res) => {
  try {
    const tradeUid = await resolveTradeActorUid(req.user.uid, req.body || {});
    const result = await closeTrade(tradeUid, req.user, req.body || {});
    if (!result.ok) return res.status(400).json(result);
    res.json({
      ok: true,
      finalPnl: result.finalPnl,
      openF: result.openF,
      closeF: result.closeF,
      tradeUid
    });
  } catch (e) {
    console.error('[trade:close]', req.user?.uid, e?.message || e);
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message || 'Close failed' });
  }
});

router.post('/api/trade/update-position', async (req, res) => {
  try {
    const { updatePositionTpSl } = require('../services/trading/engine');
    const tradeUid = await resolveTradeActorUid(req.user.uid, req.body || {});
    const result = await updatePositionTpSl(tradeUid, req.user, req.body || {});
    if (!result.ok) return res.status(400).json(result);
    res.json({ ok: true, tradeUid });
  } catch (e) {
    console.error('[trade:update-position]', req.user?.uid, e?.message || e);
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message || 'Update failed' });
  }
});

router.post('/api/wallet/virtual-balance-delta', async (req, res) => {
  try {
    const delta = Number(req.body?.delta);
    if (!Number.isFinite(delta)) return res.status(400).json({ ok: false, error: 'Invalid delta' });
    const row = await getUserByUid(req.user.uid);
    if (!row) return res.status(404).json({ ok: false, error: 'User not found' });
    const vbal = Number(row.virtual_balance);
    const next = vbal + delta;
    if (next < 0) return res.status(400).json({ ok: false, error: 'Balance would go negative' });
    const { rows } = await getPool().query(
      `update users set virtual_balance = $2, updated_at = now() where uid = $1 and virtual_balance = $3
       returning virtual_balance`,
      [req.user.uid, next, vbal]
    );
    if (!rows[0]) return res.status(409).json({ ok: false, error: 'Could not apply balance change. Try again.' });
    res.json({ ok: true, virtualBalance: Number(rows[0].virtual_balance) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/wallet/ad-trade-bonus', async (req, res) => {
  try {
    const dayKey = tradingDayKey();
    const row = await getUserByUid(req.user.uid);
    if (!row) return res.status(404).json({ ok: false, error: 'User not found' });
    if (require('../lib/paidPlan').isPaidRow(row)) {
      return res.status(400).json({
        ok: false,
        error: 'Paid members already get 20 opens/day — no ad bonus needed.'
      });
    }
    let dCount = Number(row.daily_trades_count) || 0;
    let adBonus = Number(row.daily_ad_trade_bonus) || 0;
    const dSaved = row.daily_trades_date != null ? String(row.daily_trades_date).slice(0, 10) : '';
    if (dSaved !== dayKey) {
      dCount = 0;
      adBonus = 0;
    } else {
      adBonus = Math.min(MAX_AD_TRADE_BONUS_SLOTS, Math.max(0, adBonus));
    }
    if (adBonus >= MAX_AD_TRADE_BONUS_SLOTS) {
      return res.status(400).json({
        ok: false,
        error: `Max ${MAX_AD_TRADE_BONUS_SLOTS} ad bonuses today (IST). Try tomorrow.`
      });
    }
    const nextBonus = adBonus + 1;
    const { rows: upRows } = await getPool().query(
      `update users set daily_trades_date = $2, daily_trades_count = $3, daily_ad_trade_bonus = $4, updated_at = now()
       where uid = $1 and coalesce(daily_trades_count, 0) = $5 and coalesce(daily_ad_trade_bonus, 0) = $6
       returning daily_ad_trade_bonus`,
      [req.user.uid, dayKey, dCount, nextBonus, dCount, adBonus]
    );
    if (!upRows[0]) {
      return res.status(409).json({ ok: false, error: 'Could not apply ad bonus. Try again.' });
    }
    res.json({ ok: true, dailyAdTradeBonus: nextBonus, maxBonus: MAX_AD_TRADE_BONUS_SLOTS });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/wallet/paid-free-reset', async (req, res) => {
  try {
    const { applyPaidFreeTradingReset } = require('../lib/paidFreeReset');
    const result = await applyPaidFreeTradingReset(req.user.uid);
    if (!result.ok) {
      return res.status(result.status || 400).json({ ok: false, error: result.error });
    }
    const row = await getUserByUid(req.user.uid);
    res.json({
      ok: true,
      ...result,
      user: rowToClient(row)
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/wallet/account-reset', async (req, res) => {
  try {
    const paymentId = String(req.body?.paymentId || '').trim();
    if (!paymentId) return res.status(400).json({ ok: false, error: 'Missing paymentId' });
    const { rows: payRows } = await getPool().query(`select uid, doc from payments where id = $1`, [paymentId]);
    const pay = payRows[0];
    const doc = pay?.doc && typeof pay.doc === 'object' ? pay.doc : {};
    const userUid = String(doc.user_uid || doc.userUid || pay?.uid || '');
    const product = String(doc.product_code || doc.productCode || '');
    const status = String(doc.status || '');
    if (userUid !== req.user.uid || product !== RESET_PRODUCT_CODE || status !== 'success') {
      return res.status(403).json({ ok: false, error: 'Invalid payment for this account' });
    }
    const row = await getUserByUid(req.user.uid);
    if (row?.last_processed_reset_payment_id === paymentId) {
      return res.json({ ok: true, alreadyApplied: true });
    }
    await getPool().query(
      `update users set
        virtual_balance = $2,
        positions = '[]'::jsonb,
        closed_positions = '[]'::jsonb,
        lifetime_realized_pnl = 0,
        portfolio = '[]'::jsonb,
        last_processed_reset_payment_id = $3,
        reset_at = now(),
        daily_trades_date = null,
        daily_trades_count = 0,
        daily_ad_trade_bonus = 0,
        daily_twelve_reward_claimed_date = null,
        updated_at = now()
      where uid = $1`,
      [req.user.uid, RESET_START_BALANCE, paymentId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function uidListFromDb(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      /* ignore */
    }
  }
  return [];
}

router.post('/api/social/follow-bff', async (req, res) => {
  try {
    const targetUid = String(req.body?.targetUid || '').trim();
    const action = String(req.body?.action || '').toLowerCase();
    if (!targetUid) return res.status(400).json({ ok: false, error: 'Missing targetUid' });
    if (!['follow', 'unfollow'].includes(action)) {
      return res.status(400).json({ ok: false, error: 'Invalid action' });
    }
    const actorUid = await resolveTradeActorUid(req.user.uid, req.body || {});
    if (actorUid === targetUid) return res.status(400).json({ ok: false, error: 'Invalid target' });

    const me = await getUserByUid(actorUid);
    const them = await getUserByUid(targetUid);
    if (!me || !them) return res.status(404).json({ ok: false, error: 'User not found' });

    let myFollowing = uidListFromDb(me.following);
    let theirFollowers = uidListFromDb(them.followers);

    if (action === 'follow') {
      if (!myFollowing.includes(targetUid)) myFollowing.push(targetUid);
      if (!theirFollowers.includes(actorUid)) theirFollowers.push(actorUid);
    } else {
      myFollowing = myFollowing.filter((x) => x !== targetUid);
      theirFollowers = theirFollowers.filter((x) => x !== actorUid);
    }

    await getPool().query(`update users set following = $2::text[], updated_at = now() where uid = $1`, [
      actorUid,
      myFollowing
    ]);
    await getPool().query(`update users set followers = $2::text[], updated_at = now() where uid = $1`, [
      targetUid,
      theirFollowers
    ]);
    res.json({ ok: true });
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message });
  }
});

router.post('/api/chat/typing', async (req, res) => {
  try {
    const actorUid = await resolveChatActor(req);
    const threadId = String(req.body?.threadId || '').trim();
    const clear = req.body?.clear === true || req.body?.clear === 'true';
    if (!threadId) return res.status(400).json({ ok: false, error: 'Missing threadId' });
    const { rows: tRows } = await getPool().query(`select * from dm_threads where id = $1`, [threadId]);
    const t = tRows[0];
    if (!threadIncludesUid(t, actorUid)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    const typingByUser = { ...(t.typing_by_user || {}) };
    if (clear) delete typingByUser[actorUid];
    else typingByUser[actorUid] = Date.now();
    await getPool().query(
      `update dm_threads set typing_by_user = $2::jsonb, updated_at = now() where id = $1`,
      [threadId, JSON.stringify(typingByUser)]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/cron/paid-balance-reset', async (req, res) => {
  try {
    const secret = String(process.env.CRON_SECRET || '').trim();
    const auth = String(req.headers.authorization || '');
    if (!secret || auth !== `Bearer ${secret}`) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const { applyAllDuePaidBalanceResets } = require('../lib/paidPlanBalanceReset');
    const applied = await applyAllDuePaidBalanceResets();
    res.json({ ok: true, applied });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = { publicRouter, router };
