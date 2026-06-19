const { getSupabaseAdmin } = require('../../_lib/supabaseAdmin');
const { verifyBearer } = require('../../_lib/verifyFirebaseUser');
const { json, applyApiCors, handleCorsPreflight } = require('../../_lib/http');
const { tradingDayKey, MAX_AD_TRADE_BONUS_SLOTS } = require('../../_lib/tradingDay.cjs');
const { syncTradeToFirestore } = require('../../_lib/syncTradeToFirestore.cjs');

module.exports = async (req, res) => {
  applyApiCors(req, res);
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const decoded = await verifyBearer(req);
    const supa = getSupabaseAdmin();
    const uid = decoded.uid;
    const dayKey = tradingDayKey();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data: row, error: rErr } = await supa
        .from('users')
        .select('daily_trades_date,daily_trades_count,daily_ad_trade_bonus')
        .eq('uid', uid)
        .single();
      if (rErr) throw rErr;

      let dCount = Number(row.daily_trades_count) || 0;
      let adBonus = Number(row.daily_ad_trade_bonus) || 0;
      const dSaved = row.daily_trades_date != null ? String(row.daily_trades_date).slice(0, 10) : '';

      if (dSaved !== dayKey) {
        const up = await supa
          .from('users')
          .update({
            daily_trades_date: dayKey,
            daily_trades_count: 0,
            daily_ad_trade_bonus: 1
          })
          .eq('uid', uid)
          .select('daily_ad_trade_bonus')
          .maybeSingle();
        if (up.error) throw up.error;
        if (up.data) {
          await syncTradeToFirestore(uid, {
            daily_trades_date: dayKey,
            daily_trades_count: 0,
            daily_ad_trade_bonus: 1
          });
          return json(res, 200, {
            ok: true,
            dailyAdTradeBonus: 1,
            maxBonus: MAX_AD_TRADE_BONUS_SLOTS
          });
        }
        await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
        continue;
      }

      adBonus = Math.min(MAX_AD_TRADE_BONUS_SLOTS, Math.max(0, adBonus));
      if (adBonus >= MAX_AD_TRADE_BONUS_SLOTS) {
        return json(res, 400, {
          ok: false,
          error: `Max ${MAX_AD_TRADE_BONUS_SLOTS} ad bonuses today (IST). Try tomorrow.`
        });
      }

      const nextBonus = adBonus + 1;
      const up = await supa
        .from('users')
        .update({
          daily_trades_date: dayKey,
          daily_trades_count: dCount,
          daily_ad_trade_bonus: nextBonus
        })
        .eq('uid', uid)
        .eq('daily_ad_trade_bonus', adBonus)
        .eq('daily_trades_count', dCount)
        .select('daily_ad_trade_bonus')
        .maybeSingle();

      if (up.error) throw up.error;
      if (up.data) {
        await syncTradeToFirestore(uid, {
          daily_trades_date: dayKey,
          daily_trades_count: dCount,
          daily_ad_trade_bonus: nextBonus
        });
        return json(res, 200, {
          ok: true,
          dailyAdTradeBonus: nextBonus,
          maxBonus: MAX_AD_TRADE_BONUS_SLOTS
        });
      }
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
    return json(res, 409, { ok: false, error: 'Could not apply ad bonus. Try again.' });
  } catch (e) {
    const st = e.status || 500;
    return json(res, st, { ok: false, error: e.message || 'error' });
  }
};
