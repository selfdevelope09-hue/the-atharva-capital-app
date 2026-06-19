const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { getFirestore } = require('../../_lib/firebaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { json, readBody, applyApiCors, handleCorsPreflight } = require('../../_lib/http');

const RESET_PRODUCT_CODE = 'account_reset_50';
const RESET_START_BALANCE = 10000;

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const body = readBody(req);
    const paymentId = String(body.paymentId || '').trim();
    if (!paymentId) return json(res, 400, { ok: false, error: 'Missing paymentId' });
    const uid = decoded.uid;

    const db = getFirestore();
    const paySnap = await db.collection('payments').doc(paymentId).get();
    if (!paySnap.exists) return json(res, 400, { ok: false, error: 'Payment not found' });
    const p = paySnap.data() || {};
    if (p.user_uid !== uid || p.product_code !== RESET_PRODUCT_CODE || p.status !== 'success') {
      return json(res, 403, { ok: false, error: 'Invalid payment for this account' });
    }

    const supa = getSupabaseAdmin();
    const { data: row, error: rErr } = await supa.from('users').select('*').eq('uid', uid).maybeSingle();
    if (rErr) throw rErr;
    if (row?.last_processed_reset_payment_id === paymentId) {
      return json(res, 200, { ok: true, alreadyApplied: true });
    }

    const up = await supa
      .from('users')
      .update({
        virtual_balance: RESET_START_BALANCE,
        positions: [],
        closed_positions: [],
        lifetime_realized_pnl: 0,
        portfolio: [],
        last_processed_reset_payment_id: paymentId,
        reset_at: new Date().toISOString(),
        daily_trades_date: null,
        daily_trades_count: 0,
        daily_ad_trade_bonus: 0,
        daily_twelve_reward_claimed_date: null
      })
      .eq('uid', uid);
    if (up.error) throw up.error;
    return json(res, 200, { ok: true });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
