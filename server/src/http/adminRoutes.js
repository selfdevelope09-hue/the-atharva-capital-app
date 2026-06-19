const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db/pool');
const { verifyHttpAuth } = require('../middleware/httpAuth');
const { requireAdmin, getConfigValue, setConfigValue, PRIMARY_FALLBACK } = require('../lib/platformAdminPg');
const {
  finalizeLeaderboardCampaign,
  loadCampaignConfig,
  syncLeaderboardWinnersFromLive
} = require('../lib/leaderboardCampaign');
const {
  listShowcaseRows,
  createShowcaseRow,
  updateShowcaseRow,
  deleteShowcaseRow,
  setShowcasePresence,
  bulkSetShowcasePresence,
  upsertShowcaseUser,
  appendShowcasePnlDelta
} = require('../lib/showcaseService');
const { adminLiquidateUserPosition } = require('../lib/adminLiquidatePosition');
const { syncShowcaseFromFirestore, syncShowcaseFromFirestoreIfEmpty } = require('../lib/showcaseFirestoreSync');
const { adminSetAppPassword, syncAllShowcaseAppLogins, syncShowcaseAppCredentials } = require('../lib/appLogin');

const RESET_START_BALANCE = 10000;
const { normalizePlanType, planConfig, addOneMonth, VIRTUAL_BALANCE_ON_TRADING_RESET_SQL } = require('../lib/paidPlan');
const { runMonthlyTradingReset } = require('../lib/monthlyTradingReset');
const { bustRemovedCache } = require('../lib/removedUsers');
const { backfillLifetimeRealizedPnlFromClosed } = require('../lib/leaderboardPnl');
const { setRoomChatEnabled, hideCommunityMessage, listAllRoomChatStatuses, enableAllCommunityRooms } = require('../lib/roastCommunity');
const { bulkReduceAllUsersEconomy, ALLOWED_PERCENTS } = require('../lib/bulkReduceUserEconomy');
const { computePaidBalanceResetAtIso } = require('../lib/paidPlanBalanceReset');
const router = express.Router();
router.use(verifyHttpAuth);

function tokenize(q) {
  return String(q || '')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[%_,.]/g, '').trim())
    .filter((w) => w.length >= 2);
}

function isRealUid(uid) {
  return uid && !String(uid).startsWith('showcase__');
}

router.get('/api/admin/config', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const editors = await getConfigValue('stockTipEditors');
    const blocked = await getConfigValue('blockedUsers');
    const uids = Array.isArray(editors.uids) ? editors.uids.map(String) : [];
    if (!uids.includes(PRIMARY_FALLBACK)) uids.push(PRIMARY_FALLBACK);
    res.json({
      ok: true,
      editors: [...new Set(uids)],
      blockedUids: Array.isArray(blocked.uids) ? blocked.uids.map(String) : []
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/config/blocked', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const action = String(req.body?.action || 'add');
    const uid = String(req.body?.uid || '').trim();
    if (!uid) return res.status(400).json({ ok: false, error: 'Missing uid' });
    const blocked = await getConfigValue('blockedUsers');
    let uids = Array.isArray(blocked.uids) ? blocked.uids.map(String) : [];
    if (action === 'remove') uids = uids.filter((x) => x !== uid);
    else if (!uids.includes(uid)) uids.push(uid);
    await setConfigValue('blockedUsers', { uids }, req.user.uid);
    res.json({ ok: true, blockedUids: uids });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function mapSearchUserRow(r) {
  const accountRemoved = r.account_removed === true;
  return {
    uid: r.uid,
    name: accountRemoved ? 'Removed user' : r.name,
    email: r.email || '',
    virtualBalance: Number(r.virtual_balance) || 0,
    lifetimeRealizedPnl: Number(r.lifetime_realized_pnl) || 0,
    followerCount: Array.isArray(r.followers) ? r.followers.length : 0,
    isPaidMember: r.is_paid_member === true,
    paidPlanType: r.paid_plan_type || null,
    isShowcase: r.is_showcase_profile === true || String(r.uid || '').startsWith('showcase__'),
    accountRemoved
  };
}

router.post('/api/admin/search-users', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const q = String(req.body?.q || req.body?.query || '').trim();
    if (q.length < 2) return res.json({ ok: true, users: [], source: 'postgres' });

    const words = tokenize(q);
    const exactUid = q.length >= 8 && !/\s/.test(q) ? q : '';

    if (exactUid) {
      const { rows } = await getPool().query(
        `select uid, email, name, photo_url, bio, virtual_balance, lifetime_realized_pnl, followers,
          coalesce(is_paid_member, false) as is_paid_member, paid_plan_type,
          coalesce(is_showcase_profile, false) as is_showcase_profile,
          coalesce(account_removed, false) as account_removed
         from users where uid = $1`,
        [exactUid]
      );
      if (rows[0]) {
        return res.json({ ok: true, users: [mapSearchUserRow(rows[0])], source: 'postgres' });
      }
    }

    const params = [];
    let sql = `select uid, email, name, virtual_balance, lifetime_realized_pnl, followers,
      coalesce(is_paid_member, false) as is_paid_member, paid_plan_type,
      coalesce(is_showcase_profile, false) as is_showcase_profile,
      coalesce(account_removed, false) as account_removed
      from users where 1=1`;
    if (words.length) {
      const clauses = words.map((w, i) => {
        params.push(`%${w}%`);
        const n = params.length;
        return `(lower(name) like $${n} or lower(coalesce(email,'')) like $${n} or lower(uid) like $${n})`;
      });
      sql += ` and ${clauses.join(' and ')}`;
    }
    sql += ` order by is_showcase_profile asc, name asc limit 30`;
    const { rows } = await getPool().query(sql, params);
    res.json({
      ok: true,
      users: rows.map(mapSearchUserRow),
      source: 'postgres'
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/remove-user', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const targetUid = String(req.body?.targetUid || req.body?.uid || '').trim();
    if (!targetUid) return res.status(400).json({ ok: false, error: 'Missing targetUid' });
    if (targetUid === req.user.uid) {
      return res.status(400).json({ ok: false, error: 'Cannot remove your own account' });
    }
    const { rows } = await getPool().query(
      `update users set account_removed = true, account_removed_at = now(), updated_at = now()
       where uid = $1
       returning uid, name, email, coalesce(account_removed, false) as account_removed`,
      [targetUid]
    );
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'User not found in Postgres' });
    bustRemovedCache();
    res.json({
      ok: true,
      targetUid,
      name: rows[0].name,
      email: rows[0].email || '',
      accountRemoved: true
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/restore-user', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const targetUid = String(req.body?.targetUid || req.body?.uid || '').trim();
    if (!targetUid) return res.status(400).json({ ok: false, error: 'Missing targetUid' });
    const { rows } = await getPool().query(
      `update users set account_removed = false, account_removed_at = null, updated_at = now()
       where uid = $1
       returning uid, name, email, coalesce(account_removed, false) as account_removed`,
      [targetUid]
    );
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'User not found in Postgres' });
    bustRemovedCache();
    res.json({
      ok: true,
      targetUid,
      name: rows[0].name,
      email: rows[0].email || '',
      accountRemoved: false
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/reset-user-trading', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const targetUid = String(req.body?.targetUid || req.body?.uid || '').trim();
    if (!targetUid) return res.status(400).json({ ok: false, error: 'Missing targetUid' });
    const { rows } = await getPool().query(
      `update users set
        virtual_balance = ${VIRTUAL_BALANCE_ON_TRADING_RESET_SQL},
        lifetime_realized_pnl = 0,
        positions = '[]'::jsonb,
        closed_positions = '[]'::jsonb,
        portfolio = '[]'::jsonb,
        daily_trades_date = null,
        daily_trades_count = 0,
        daily_ad_trade_bonus = 0,
        daily_twelve_reward_claimed_date = null,
        reset_at = now(),
        updated_at = now()
      where uid = $1
      returning uid, name, email, virtual_balance, lifetime_realized_pnl, is_paid_member, paid_plan_type`,
      [targetUid]
    );
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'User not found in Postgres' });
    if (targetUid.startsWith('showcase__')) {
      await getPool().query(
        `update leaderboard_showcase set pnl = 0, trade_count = 0, updated_at = now()
         where profile_uid = $1`,
        [targetUid]
      );
    }
    res.json({
      ok: true,
      targetUid,
      name: rows[0].name,
      email: rows[0].email || '',
      virtualBalance: Number(rows[0].virtual_balance),
      lifetimeRealizedPnl: 0,
      source: 'postgres'
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/liquidate-position', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const targetUid = String(req.body?.targetUid || req.body?.uid || '').trim();
    const uiIndex = Number(req.body?.uiIndex);
    const position = req.body?.position && typeof req.body.position === 'object' ? req.body.position : {};
    if (!targetUid) return res.status(400).json({ ok: false, error: 'Missing targetUid' });
    if (!Number.isInteger(uiIndex) || uiIndex < 0) {
      return res.status(400).json({ ok: false, error: 'Missing valid uiIndex' });
    }
    const result = await adminLiquidateUserPosition(targetUid, uiIndex, position);
    if (!result.ok) return res.status(result.error === 'User not found' ? 404 : 400).json(result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/adjust-followers', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const targetUid = String(req.body?.targetUid || req.body?.uid || '').trim();
    const action = String(req.body?.action || '').trim().toLowerCase();
    const countRaw = Number(req.body?.count);
    const count = Math.max(1, Math.min(500, Number.isFinite(countRaw) ? Math.floor(countRaw) : 0));
    if (!targetUid) return res.status(400).json({ ok: false, error: 'Missing targetUid' });
    if (!['increase', 'decrease'].includes(action)) {
      return res.status(400).json({ ok: false, error: 'Invalid action. Use increase or decrease.' });
    }
    if (!count) return res.status(400).json({ ok: false, error: 'Enter valid count (1-500).' });

    const { rows: targetRows } = await getPool().query(`select uid, followers from users where uid = $1`, [targetUid]);
    if (!targetRows[0]) return res.status(404).json({ ok: false, error: 'Target user not found' });

    const currentFollowersRaw = Array.isArray(targetRows[0].followers)
      ? targetRows[0].followers.map(String)
      : [];
    const currentFollowers = [...new Set(currentFollowersRaw.filter(Boolean))];

    let selected = [];
    if (action === 'increase') {
      const blockedSet = new Set(currentFollowers);
      blockedSet.add(targetUid);
      const exclude = Array.from(blockedSet);
      const { rows: picks } = await getPool().query(
        `select uid from users
         where uid like 'showcase__%'
           and not (uid = any($1::text[]))
         order by random()
         limit $2`,
        [exclude, count]
      );
      selected = picks.map((r) => String(r.uid)).filter(Boolean);
    } else {
      const showcaseFollowers = currentFollowers.filter((uid) => uid.startsWith('showcase__'));
      if (showcaseFollowers.length) {
        const { rows: picks } = await getPool().query(
          `select uid from users
           where uid = any($1::text[])
           order by random()
           limit $2`,
          [showcaseFollowers, count]
        );
        selected = picks.map((r) => String(r.uid)).filter(Boolean);
      }
    }

    const selectedSet = new Set(selected);
    let nextFollowers = currentFollowers;
    if (action === 'increase') {
      nextFollowers = [...new Set([...currentFollowers, ...selected])];
    } else if (selected.length) {
      nextFollowers = currentFollowers.filter((uid) => !selectedSet.has(uid));
    }

    await getPool().query(`update users set followers = $2::text[], updated_at = now() where uid = $1`, [
      targetUid,
      nextFollowers
    ]);

    if (selected.length) {
      if (action === 'increase') {
        await getPool().query(
          `update users
           set following = array(select distinct unnest(coalesce(following,'{}'::text[]) || $2::text[])),
               updated_at = now()
           where uid = any($1::text[])`,
          [selected, [targetUid]]
        );
      } else {
        await getPool().query(
          `update users
           set following = array_remove(coalesce(following,'{}'::text[]), $2),
               updated_at = now()
           where uid = any($1::text[])`,
          [selected, targetUid]
        );
      }
    }

    res.json({
      ok: true,
      targetUid,
      action,
      requested: count,
      applied: selected.length,
      followerCount: nextFollowers.length,
      followers: nextFollowers
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/set-paid-member', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const targetUid = String(req.body?.targetUid || req.body?.uid || '').trim();
    const planRaw = req.body?.plan != null ? req.body.plan : req.body?.planType;
    const active = req.body?.active !== false && req.body?.active !== 'false' && planRaw !== 'none' && planRaw !== null;
    if (!targetUid) return res.status(400).json({ ok: false, error: 'Missing targetUid' });

    const planType = active ? normalizePlanType(planRaw || 'basic') : null;
    if (active && !planType) {
      return res.status(400).json({ ok: false, error: 'Invalid plan — use basic, pro, or ultimate_pro' });
    }

    const { rows: existing } = await getPool().query(
      `select uid, coalesce(is_paid_member, false) as is_paid_member,
        paid_plan_type, coalesce(creds_paid_bonus, 0) as creds_paid_bonus,
        virtual_balance, coalesce(lifetime_realized_pnl, 0) as lifetime_realized_pnl
       from users where uid = $1`,
      [targetUid]
    );
    if (!existing[0]) return res.status(404).json({ ok: false, error: 'User not found in Postgres' });

    const cfg = planType ? planConfig(planType) : null;
    let credsBonus = Number(existing[0].creds_paid_bonus) || 0;
    const lifetimePnl = Number(existing[0].lifetime_realized_pnl) || 0;
    const until = planType ? addOneMonth(new Date()) : null;
    const paidBalanceResetAt = cfg ? computePaidBalanceResetAtIso(Date.now()) : null;
    const nextBalance =
      cfg && planType
        ? Math.max(0, Number(cfg.startBalance || 0) + lifetimePnl)
        : null;

    if (planType) {
      credsBonus = Math.max(credsBonus, cfg.credsBonus);
      const { rows } = await getPool().query(
        `update users set
          is_paid_member = true,
          paid_plan_type = $2,
          paid_member_granted_at = now(),
          paid_member_granted_by = $3,
          paid_member_until = $4,
          creds_paid_bonus = $5,
          paid_balance_reset_at = $6::timestamptz,
          paid_balance_reset_applied_at = now(),
          virtual_balance = $7,
          daily_trades_date = null,
          daily_trades_count = 0,
          daily_ad_trade_bonus = 0,
          daily_twelve_reward_claimed_date = null,
          paid_free_resets_used = 0,
          updated_at = now()
        where uid = $1
        returning uid, name, email, is_paid_member, paid_plan_type, creds_paid_bonus,
          paid_member_granted_at, paid_member_until, virtual_balance, paid_balance_reset_at`,
        [targetUid, planType, req.user.uid, until, credsBonus, paidBalanceResetAt, nextBalance]
      );
      if (!rows[0]) {
        return res.status(404).json({ ok: false, error: 'User not found in Postgres' });
      }
      const { rows: fresh } = await getPool().query(
        `select uid, name, email, is_paid_member, paid_plan_type, creds_paid_bonus,
          paid_member_granted_at, paid_member_until, virtual_balance, paid_balance_reset_at
         from users where uid = $1`,
        [targetUid]
      );
      const row = fresh[0] || rows[0];
      return res.json({
        ok: true,
        targetUid,
        name: row.name,
        email: row.email || '',
        isPaidMember: row.is_paid_member === true,
        paidPlanType: row.paid_plan_type,
        credsPaidBonus: Number(row.creds_paid_bonus) || 0,
        paidMemberGrantedAt: row.paid_member_granted_at
          ? new Date(row.paid_member_granted_at).toISOString()
          : null,
        paidMemberUntil: row.paid_member_until
          ? new Date(row.paid_member_until).toISOString()
          : null,
        virtualBalance: Number(row.virtual_balance),
        paidBalanceResetAt: row.paid_balance_reset_at
          ? new Date(row.paid_balance_reset_at).toISOString()
          : null,
        balanceGrantedNow: true,
        source: 'postgres'
      });
    }

    const { rows } = await getPool().query(
      `update users set
        is_paid_member = false,
        paid_plan_type = null,
        paid_member_granted_at = null,
        paid_member_granted_by = null,
        paid_member_until = null,
        paid_balance_reset_at = null,
        paid_balance_reset_applied_at = null,
        updated_at = now()
      where uid = $1
      returning uid, name, email, is_paid_member, paid_plan_type, creds_paid_bonus,
        paid_member_granted_at, paid_member_until, virtual_balance, paid_balance_reset_at`,
      [targetUid]
    );
    if (!rows[0]) {
      return res.status(404).json({ ok: false, error: 'User not found in Postgres' });
    }

    res.json({
      ok: true,
      targetUid,
      name: rows[0].name,
      email: rows[0].email || '',
      isPaidMember: false,
      paidPlanType: null,
      credsPaidBonus: Number(rows[0].creds_paid_bonus) || 0,
      paidMemberGrantedAt: null,
      paidMemberUntil: null,
      virtualBalance: Number(rows[0].virtual_balance),
      paidBalanceResetAt: null,
      balanceGrantedNow: false,
      source: 'postgres'
    });
  } catch (e) {
    console.error('set-paid-member', e);
    res.status(500).json({ ok: false, error: e.message || 'set-paid-member failed' });
  }
});

router.post('/api/admin/monthly-reset', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const result = await runMonthlyTradingReset();
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** Recompute lifetime_realized_pnl from closed_positions (fixes leaderboard after bad sync). */
router.post('/api/admin/backfill-leaderboard-pnl', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const updated = await backfillLifetimeRealizedPnlFromClosed();
    res.json({ ok: true, usersUpdated: updated, clearLeaderboardClientCache: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** @deprecated Prefer POST /api/admin/monthly-reset */
router.post('/api/admin/reset-all-trading', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const result = await runMonthlyTradingReset();
    res.json({ ...result, legacyEndpoint: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/showcase-presence', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const profileUid = String(req.body?.profileUid || '').trim();
    const entryId = String(req.body?.entryId || '').trim();
    const online = req.body?.online === true || req.body?.online === 'true';
    if (!profileUid.startsWith('showcase__')) {
      return res.status(400).json({ ok: false, error: 'profileUid must be showcase__*' });
    }
    if (!entryId) return res.status(400).json({ ok: false, error: 'Missing entryId' });
    await setShowcasePresence(entryId, profileUid, online);
    res.json({ ok: true, profileUid, entryId, online });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/showcase-presence-bulk', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const count = req.body?.count;
    const mode = String(req.body?.mode || '').trim().toLowerCase();
    const result = await bulkSetShowcasePresence(count, mode);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

router.get('/api/admin/showcase', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    let firestoreSynced = 0;
    let rows = await listShowcaseRows();
    if (rows.length === 0) {
      try {
        firestoreSynced = await syncShowcaseFromFirestoreIfEmpty();
        if (firestoreSynced > 0) rows = await listShowcaseRows();
      } catch (syncErr) {
        console.warn('showcase firestore sync', syncErr?.message || syncErr);
      }
    }
    res.json({ ok: true, rows, firestoreSynced });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/showcase/sync-logins', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { updated, total } = await syncAllShowcaseAppLogins();
    const rows = await listShowcaseRows();
    res.json({ ok: true, updated, total, rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/showcase/sync-firestore', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const imported = await syncShowcaseFromFirestore({ force: true });
    const rows = await listShowcaseRows();
    res.json({ ok: true, rows, imported, firestoreSynced: imported });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/showcase', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const displayName = String(req.body?.displayName || '').trim();
    const pnl = parseFloat(String(req.body?.pnl || '').replace(/,/g, ''));
    const tradeCount = Math.max(1, Math.min(500, parseInt(String(req.body?.tradeCount || '12'), 10) || 12));
    const photoURL = String(req.body?.photoURL || '').trim();
    const bio = String(req.body?.bio || '').trim();
    if (!displayName || !Number.isFinite(pnl)) {
      return res.status(400).json({ ok: false, error: 'displayName and valid pnl required' });
    }
    const row = await createShowcaseRow({ displayName, pnl, tradeCount, photoURL, bio });
    res.json({ ok: true, row });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.patch('/api/admin/showcase/:id', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = String(req.params.id || '').trim();
    const displayName = String(req.body?.displayName || '').trim();
    const pnl = parseFloat(String(req.body?.pnl || '').replace(/,/g, ''));
    const tradeCount = Math.max(1, Math.min(500, parseInt(String(req.body?.tradeCount || '12'), 10) || 12));
    const photoURL = String(req.body?.photoURL || '').trim();
    const bio = String(req.body?.bio || '').trim();
    if (!displayName || !Number.isFinite(pnl)) {
      return res.status(400).json({ ok: false, error: 'displayName and valid pnl required' });
    }
    const row = await updateShowcaseRow(id, { displayName, pnl, tradeCount, photoURL, bio });
    res.json({ ok: true, row });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/showcase/:id/add-pnl', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = String(req.params.id || '').trim();
    const delta = parseFloat(String(req.body?.delta ?? req.body?.pnl ?? '').replace(/,/g, ''));
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ ok: false, error: 'Enter a non-zero P/L amount (e.g. 1000 or -500)' });
    }
    const result = await appendShowcasePnlDelta(id, delta);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** Flat route — Vercel single-segment proxy (avoids nested-path 404). */
router.post('/api/admin/showcase-add-pnl', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = String(req.body?.id || req.body?.showcaseId || '').trim();
    const delta = parseFloat(String(req.body?.delta ?? req.body?.pnl ?? '').replace(/,/g, ''));
    if (!id) return res.status(400).json({ ok: false, error: 'Missing showcase id' });
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ ok: false, error: 'Enter a non-zero P/L amount (e.g. 1000 or -500)' });
    }
    const result = await appendShowcasePnlDelta(id, delta);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.delete('/api/admin/showcase/:id', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    await deleteShowcaseRow(String(req.params.id || '').trim());
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/showcase/import', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const entries = Array.isArray(req.body?.rows) ? req.body.rows : [];
    let ok = 0;
    const errs = [];
    for (const entry of entries) {
      try {
        const id = String(entry.id || entry.lb?.id || crypto.randomUUID().slice(0, 20)).trim();
        const lb = entry.lb || entry;
        const displayName = String(lb.displayName || lb.display_name || '').trim();
        const pnl = parseFloat(String(lb.pnl ?? 0).replace(/,/g, ''));
        const tradeCount = Math.max(1, parseInt(String(lb.tradeCount ?? lb.trade_count ?? 12), 10) || 12);
        if (!displayName || !Number.isFinite(pnl)) throw new Error('invalid row');
        const profileUid = String(lb.profile_uid || `showcase__${id}`).trim();
        const online = lb.showcasePresenceOnline === true || lb.showcase_presence_online === true;
        await getPool().query(
          `insert into leaderboard_showcase (id, display_name, pnl, trade_count, profile_uid, showcase_presence_online, showcase_presence_offline_at, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,now())
           on conflict (id) do update set
             display_name = excluded.display_name,
             pnl = excluded.pnl,
             trade_count = excluded.trade_count,
             profile_uid = excluded.profile_uid,
             showcase_presence_online = excluded.showcase_presence_online,
             showcase_presence_offline_at = excluded.showcase_presence_offline_at,
             updated_at = now()`,
          [
            id,
            displayName,
            pnl,
            tradeCount,
            profileUid,
            online,
            online ? null : new Date()
          ]
        );
        const bu = entry.user || entry.users || {};
        await upsertShowcaseUser(
          {
            uid: profileUid,
            name: displayName,
            photo_url: bu.photoURL || bu.photo_url || '',
            bio: bu.bio || '',
            lifetime_realized_pnl: pnl,
            showcase_trade_count: tradeCount,
            showcase_presence_online: online,
            showcase_presence_offline_at: online ? null : new Date()
          },
          true
        );
        await syncShowcaseAppCredentials(profileUid, displayName);
        ok += 1;
      } catch (e) {
        errs.push(e.message);
      }
    }
    res.json({ ok: true, imported: ok, errors: errs });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/api/admin/showcase/export', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const rows = await listShowcaseRows();
    const pack = { exportedAt: new Date().toISOString(), rows: [] };
    for (const row of rows) {
      const { rows: uRows } = await getPool().query(
        `select photo_url, bio, closed_positions, lifetime_realized_pnl, virtual_balance, showcase_trade_count from users where uid = $1`,
        [row.profile_uid]
      );
      const u = uRows[0] || {};
      pack.rows.push({
        id: row.id,
        lb: row,
        user: {
          photoURL: u.photo_url,
          bio: u.bio,
          closedPositions: u.closed_positions,
          lifetimeRealizedPnl: u.lifetime_realized_pnl,
          virtualBalance: u.virtual_balance,
          showcaseTradeCount: u.showcase_trade_count
        }
      });
    }
    res.json({ ok: true, pack });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/showcase/:id/follow', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = String(req.params.id || '').trim();
    const targetUid = String(req.body?.targetUid || '').trim();
    const { rows } = await getPool().query(`select profile_uid from leaderboard_showcase where id = $1`, [id]);
    const profileUid = rows[0]?.profile_uid;
    if (!profileUid) return res.status(404).json({ ok: false, error: 'Showcase not found' });
    if (targetUid === profileUid) return res.status(400).json({ ok: false, error: 'Cannot follow self' });
    const { rows: themRows } = await getPool().query(`select followers from users where uid = $1`, [targetUid]);
    let theirFollowers = Array.isArray(themRows[0]?.followers) ? themRows[0].followers.map(String) : [];
    if (!theirFollowers.includes(profileUid)) theirFollowers.push(profileUid);
    await getPool().query(
      `update users set following = array(select distinct unnest(following || $2::text[])), updated_at = now() where uid = $1`,
      [profileUid, [targetUid]]
    );
    await getPool().query(`update users set followers = $2::text[], updated_at = now() where uid = $1`, [
      targetUid,
      theirFollowers
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/api/admin/leaderboard/campaign-status', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const campaign = await loadCampaignConfig();
    res.json({ ok: true, campaign: campaign || { finalized: false } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/leaderboard/finalize-campaign', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const force = req.body?.force === true;
    const result = await finalizeLeaderboardCampaign({ force });
    if (result.ok === false) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/leaderboard/sync-winners', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const result = await syncLeaderboardWinnersFromLive();
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/showcase/rebuild-trades', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const rows = await listShowcaseRows();
    let n = 0;
    for (const row of rows) {
      await upsertShowcaseUser(
        {
          uid: row.profile_uid,
          name: row.displayName,
          photo_url: '',
          bio: '',
          lifetime_realized_pnl: row.pnl,
          showcase_trade_count: row.tradeCount,
          showcase_presence_online: row.showcasePresenceOnline,
          showcase_presence_offline_at: row.showcasePresenceOfflineAt
        },
        false
      );
      n += 1;
    }
    res.json({ ok: true, rebuilt: n });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/api/admin/chat-logs', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const lim = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '120'), 10) || 120));
    const { rows } = await getPool().query(
      `select m.id, m.thread_id, m.from_uid, m.from_name, m.text, m.image_url, m.file_url, m.file_name, m.media_kind, m.created_at,
              t.participants, t.names
       from dm_messages m
       inner join dm_threads t on t.id = m.thread_id
       where exists (
         select 1 from unnest(t.participants) as participant_uid
         where participant_uid like 'showcase__%'
       )
       and m.from_uid not like 'showcase__%'
       order by m.created_at desc
       limit $1`,
      [lim]
    );
    res.json({
      ok: true,
      logs: rows.map((r) => {
        const parts = Array.isArray(r.participants) ? r.participants : [];
        const names = r.names && typeof r.names === 'object' ? r.names : {};
        const showcaseUid = parts.find((p) => String(p || '').startsWith('showcase__')) || '';
        let preview = String(r.text || '').trim();
        if (!preview && r.image_url) preview = '📷 Photo';
        else if (!preview && r.file_url) preview = r.file_name ? `📎 ${r.file_name}` : '📎 File';
        return {
          id: r.id,
          threadId: r.thread_id,
          peerShowcaseId: showcaseUid,
          peerShowcaseName: names[showcaseUid] || showcaseUid || 'Showcase',
          fromUid: r.from_uid,
          fromName: r.from_name,
          text: preview,
          imageUrl: r.image_url || '',
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null
        };
      })
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/api/admin/tip-queries', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { rows } = await getPool().query(`select id, doc, created_at from tip_queries order by created_at desc limit 80`);
    res.json({
      ok: true,
      queries: rows.map((r) => ({ id: r.id, ...r.doc, created_at: r.created_at }))
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/api/admin/migrate-trading-schema', async (req, res) => {
  res.json({ ok: true, message: 'Postgres schema active on DigitalOcean' });
});

router.post('/api/admin/user-app-login', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const uid = String(req.body?.uid || '').trim();
    const password = String(req.body?.password || '');
    const loginId = String(req.body?.loginId || '').trim();
    if (!uid || !password) {
      return res.status(400).json({ ok: false, error: 'uid and password required' });
    }
    const result = await adminSetAppPassword(uid, password, loginId || null);
    res.json({ ok: true, ...result });
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ ok: false, error: e.message });
  }
});

router.get('/api/admin/community-room-status', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const rooms = await listAllRoomChatStatuses();
    res.json({ ok: true, rooms });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/community-room-enable-all', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    await enableAllCommunityRooms();
    const rooms = await listAllRoomChatStatuses();
    res.json({ ok: true, rooms });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/bulk-reduce-economy', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const percent = parseInt(String(req.body?.percent ?? ''), 10);
    if (!ALLOWED_PERCENTS.includes(percent)) {
      return res.status(400).json({
        ok: false,
        error: `percent must be one of: ${ALLOWED_PERCENTS.join(', ')}`
      });
    }
    const result = await bulkReduceAllUsersEconomy(percent);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/community-room-toggle', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const roomId = String(req.body?.room || 'community').trim().toLowerCase();
    const enabled = req.body?.enabled !== false;
    await setRoomChatEnabled(roomId, enabled);
    const status = await listAllRoomChatStatuses();
    const room = status.find((r) => r.roomId === roomId);
    res.json({ ok: true, room: roomId, chatEnabled: enabled, rooms: status });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/admin/community-message-disable', async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const messageId = String(req.body?.messageId || '').trim();
    if (!messageId) return res.status(400).json({ ok: false, error: 'Missing messageId' });
    const ok = await hideCommunityMessage(messageId, true);
    if (!ok) return res.status(404).json({ ok: false, error: 'Message not found' });
    res.json({ ok: true, messageId, hidden: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
