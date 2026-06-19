const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');

const BASIC_FREE_RESET_LIMIT = 3;
const PRO_FREE_RESET_LIMIT = 5;
const ULTIMATE_PRO_FREE_RESET_LIMIT = 10;
const BASIC_START_BALANCE = 20000;
const PRO_START_BALANCE = 50000;
const ULTIMATE_PRO_START_BALANCE = 250000;

const PAID_PLANS = new Set(['basic', 'pro', 'ultimate_pro']);

function normalizePlanType(v) {
  const s = String(v || '').trim().toLowerCase();
  return PAID_PLANS.has(s) ? s : null;
}

function planConfig(planType) {
  const t = normalizePlanType(planType);
  if (t === 'ultimate_pro') {
    return { freeResets: ULTIMATE_PRO_FREE_RESET_LIMIT, startBalance: ULTIMATE_PRO_START_BALANCE };
  }
  if (t === 'pro') {
    return { freeResets: PRO_FREE_RESET_LIMIT, startBalance: PRO_START_BALANCE };
  }
  if (t === 'basic') {
    return { freeResets: BASIC_FREE_RESET_LIMIT, startBalance: BASIC_START_BALANCE };
  }
  return null;
}

function isPaidRow(row) {
  if (!row || row.is_paid_member !== true) return false;
  if (!normalizePlanType(row.paid_plan_type)) return false;
  if (row.paid_member_until) {
    const untilMs = new Date(row.paid_member_until).getTime();
    if (Number.isFinite(untilMs) && untilMs <= Date.now()) return false;
  }
  return true;
}

function freeResetLimit(row) {
  if (!isPaidRow(row)) return 0;
  return planConfig(row.paid_plan_type)?.freeResets ?? 0;
}

function freeResetsRemaining(row) {
  const used = Math.max(0, Number(row.paid_free_resets_used) || 0);
  return Math.max(0, freeResetLimit(row) - used);
}

function planStartBalance(row) {
  if (!isPaidRow(row)) return 10000;
  return planConfig(row.paid_plan_type)?.startBalance ?? 10000;
}

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const uid = decoded.uid;
    const supa = getSupabaseAdmin();
    const { data: row, error: rErr } = await supa.from('users').select('*').eq('uid', uid).maybeSingle();
    if (rErr) throw rErr;
    if (!row) return json(res, 404, { ok: false, error: 'User not found' });
    if (!isPaidRow(row)) {
      return json(res, 403, { ok: false, error: 'Active paid plan required for free resets' });
    }
    if (freeResetsRemaining(row) <= 0) {
      return json(res, 403, { ok: false, error: 'No free resets left on your plan' });
    }

    const nextBalance = planStartBalance(row);
    const { error: upErr } = await supa
      .from('users')
      .update({
        virtual_balance: nextBalance,
        positions: [],
        closed_positions: [],
        lifetime_realized_pnl: 0,
        portfolio: [],
        paid_free_resets_used: (Number(row.paid_free_resets_used) || 0) + 1,
        reset_at: new Date().toISOString(),
        daily_trades_date: null,
        daily_trades_count: 0,
        daily_ad_trade_bonus: 0,
        daily_twelve_reward_claimed_date: null
      })
      .eq('uid', uid);
    if (upErr) throw upErr;

    const used = (Number(row.paid_free_resets_used) || 0) + 1;
    const limit = freeResetLimit(row);
    return json(res, 200, {
      ok: true,
      virtualBalance: nextBalance,
      planType: row.paid_plan_type,
      freeResetsUsed: used,
      freeResetsRemaining: Math.max(0, limit - used),
      freeResetsLimit: limit,
      startBalanceUsd: nextBalance
    });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
