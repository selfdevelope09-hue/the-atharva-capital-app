import React, { useState, useContext, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  doc,
  collection,
  query,
  where,
  limit,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';
import { AuthContext } from '../authContext';
import { db } from '../firebaseClient';
import { activateBffQuotaFallback, isBffDataMode, isSupabaseFallbackEnabled } from '../config/dataBackend';
import { bff } from '../api/serverBff';
import { shouldFallbackFromFirestoreToSupabase } from '../utils/firestoreQuota';
import { T } from '../app/theme';
import { Card, Btn } from '../components/ui/AppPrimitives';
import {
  MAX_AD_TRADE_BONUS_SLOTS,
  MAX_DAILY_OPENS,
  getAdTradeBonusEarned,
  getEffectiveDailyOpenLimit,
  isPaidMember
} from '../utils/tradingDayLimit';
import {
  PLAN_CATALOG,
  FREE_PLAN_FEATURES,
  getPlanConfig,
  getPlanLabel,
  paidPlanDaysLeft,
  paidPlanChatPath,
  paidBalanceResetLabel,
  paidFreeResetsRemaining,
  paidFreeResetLimit,
  PLAN_ORDER
} from '../config/paidPlan';
import PaidMemberBadge, { PlanTierChip } from '../components/PaidMemberBadge';
import PaidFreeResetButton from '../components/PaidFreeResetButton';

function formatExpiry(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '—';
  }
}

export const WalletScreen = () => {
  const { user, userData, refreshUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [msg, setMsg] = useState(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [tradeAdBusy, setTradeAdBusy] = useState(false);

  const userIsPaid = isPaidMember(userData);
  const activePlan = getPlanConfig(userData);
  const planLabel = getPlanLabel(userData);
  const daysLeft = paidPlanDaysLeft(userData);
  const expiryIso = userData?.paidMemberUntil;
  const balanceResetLabel = paidBalanceResetLabel(userData);
  const planStartBalance = activePlan?.startBalanceUsd;
  const freeResetsLeft = paidFreeResetsRemaining(userData);
  const freeResetsLimit = paidFreeResetLimit(userData);

  const RESET_PRICE_INR = 50;
  const RESET_PRODUCT_CODE = 'account_reset_50';
  const RESET_START_BALANCE = 10000;

  const goToPlanChat = (planId) => {
    navigate(paidPlanChatPath(planId));
  };

  const openResetPaymentUpi = () => {
    if (!user?.uid) {
      setMsg({ t: 'error', m: 'Please login first.' });
      return;
    }
    const payee = process.env.REACT_APP_PREMIUM_UPI_ID || process.env.REACT_APP_RESET_UPI_ID || '';
    if (!payee) {
      setMsg({ t: 'error', m: 'UPI not configured. Please contact admin.' });
      return;
    }
    const tr = `RESET_${user.uid}_${Date.now()}`;
    const params = new URLSearchParams({
      pa: payee,
      pn: 'AuronX',
      am: String(RESET_PRICE_INR),
      cu: 'INR',
      tn: 'AuronX account reset',
      tr
    });
    window.location.href = `upi://pay?${params.toString()}`;
    setMsg({ t: 'success', m: 'UPI app opened. After payment, account will auto-reset.' });
  };

  useEffect(() => {
    if (!user?.uid || isBffDataMode()) return undefined;
    const qy = query(
      collection(db, 'payments'),
      where('user_uid', '==', user.uid),
      where('product_code', '==', RESET_PRODUCT_CODE),
      where('status', '==', 'success'),
      limit(1)
    );
    const unsub = onSnapshot(qy, async (snap) => {
      if (snap.empty) return;
      const paymentId = snap.docs[0].id;
      if (userData?.lastProcessedResetPaymentId === paymentId) return;
      setResetBusy(true);
      try {
        await bff('/api/wallet/account-reset', { method: 'POST', body: JSON.stringify({ paymentId }) });
        await refreshUser();
        setMsg({ t: 'success', m: `Account reset — balance restored to $${RESET_START_BALANCE.toLocaleString()}.` });
      } catch (e) {
        setMsg({ t: 'error', m: e?.message || 'Reset failed.' });
      }
      setResetBusy(false);
    });
    return unsub;
  }, [RESET_PRODUCT_CODE, RESET_START_BALANCE, refreshUser, user?.uid, userData?.lastProcessedResetPaymentId]);

  const claimExtraTradeViaAd = async () => {
    if (!user?.uid) {
      setMsg({ t: 'error', m: 'Please login first.' });
      return;
    }
    if (userIsPaid) return;
    const earned = getAdTradeBonusEarned(userData);
    if (earned >= MAX_AD_TRADE_BONUS_SLOTS) {
      setMsg({ t: 'error', m: `All ${MAX_AD_TRADE_BONUS_SLOTS} ad slots used today.` });
      return;
    }
    setTradeAdBusy(true);
    setMsg(null);
    await new Promise((r) => setTimeout(r, 2800));
    try {
      if (isBffDataMode()) {
        await bff('/api/wallet/ad-trade-bonus', { method: 'POST', body: '{}' });
      } else {
        try {
          await runTransaction(db, async (tx) => {
            const ref = doc(db, 'users', user.uid);
            const snap = await tx.get(ref);
            if (!snap.exists()) throw new Error('User not found');
            const raw = snap.data();
            const dk = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            let adB = Number(raw.dailyAdTradeBonus) || 0;
            const dSaved = raw.dailyTradesDate != null ? String(raw.dailyTradesDate).slice(0, 10) : '';
            if (dSaved !== dk) adB = 0;
            if (adB >= MAX_AD_TRADE_BONUS_SLOTS) throw new Error('Max ad bonuses today');
            tx.update(ref, { dailyTradesDate: dk, dailyAdTradeBonus: adB + 1 });
          });
        } catch (e) {
          if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) {
            activateBffQuotaFallback();
            await bff('/api/wallet/ad-trade-bonus', { method: 'POST', body: '{}' });
          } else throw e;
        }
      }
      await refreshUser();
      setMsg({ t: 'success', m: `+1 trade slot unlocked for today.` });
    } catch (e) {
      setMsg({ t: 'error', m: e?.message || 'Could not apply bonus.' });
    }
    setTradeAdBusy(false);
  };

  const walletRewardsLink = ({ isActive }) => ({
    padding: '8px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
    border: `1px solid ${isActive ? T.yellow : T.border}`,
    background: isActive ? 'rgba(240,185,11,0.14)' : 'rgba(26,26,26,0.95)',
    color: isActive ? T.yellow : T.text
  });

  const planCard = (key) => {
    const p = PLAN_CATALOG[key];
    const isActive = userIsPaid && activePlan?.id === key;
    return (
      <div
        key={key}
        style={{
          padding: 14,
          borderRadius: 12,
          background: p.cardBg || 'rgba(0,149,246,0.08)',
          border: `1px solid ${isActive ? p.accent : T.border}`,
          boxShadow: isActive ? `0 0 0 1px ${p.accent}` : 'none'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: p.accent, fontWeight: 900, fontSize: 15 }}>{p.label}</span>
          <span style={{ color: T.white, fontWeight: 800 }}>₹{p.priceInr}/mo</span>
        </div>
        <ul style={{ margin: '0 0 12px', paddingLeft: 16, color: T.text, fontSize: 11, lineHeight: 1.55 }}>
          {p.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        {!userIsPaid ? (
          <Btn
            onClick={() => goToPlanChat(key)}
            style={{
              width: '100%',
              background: p.btnGradient || `linear-gradient(135deg, ${p.accent}, ${p.accent})`,
              color: '#fff',
              border: 'none',
              fontWeight: 800,
              fontSize: 13
            }}
          >
            Get {p.label} — Chat to subscribe
          </Btn>
        ) : isActive ? (
          <div style={{ color: p.accent, fontWeight: 800, fontSize: 12, textAlign: 'center' }}>Current plan ✓</div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      style={{
        padding: 16,
        maxWidth: 600,
        margin: '0 auto',
        paddingBottom: 'max(96px, calc(72px + env(safe-area-inset-bottom, 0px)))'
      }}
    >
      <nav style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <NavLink to="/wallet" end style={walletRewardsLink}>
          Wallet
        </NavLink>
        <NavLink to="/rewards" style={walletRewardsLink}>
          Rewards
        </NavLink>
      </nav>

      <h2 style={{ color: T.white, marginBottom: 20 }}>Wallet</h2>

      {msg ? (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 8,
            background: msg.t === 'success' ? 'rgba(2,192,118,0.15)' : 'rgba(246,70,93,0.15)',
            color: msg.t === 'success' ? T.green : T.red,
            fontSize: 13
          }}
        >
          {msg.m}
        </div>
      ) : null}

      <Card style={{ marginBottom: 20 }}>
        <div style={{ color: T.text, fontSize: 13, marginBottom: 6 }}>Total Equity (USDT)</div>
        <div style={{ color: T.white, fontSize: 36, fontWeight: 900 }}>
          $
          {parseFloat(userData?.virtualBalance || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </div>
        <div style={{ color: T.text, fontSize: 12, marginTop: 8 }}>Paper trading • No real funds</div>
      </Card>

      <Card style={{ marginBottom: 20, border: `1px solid ${userIsPaid ? activePlan?.accent || '#0095F6' : T.yellow}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <h3 style={{ color: T.white, margin: 0, fontSize: 16 }}>
            {userIsPaid ? `${planLabel} Plan Active` : 'Subscription Plans'}
          </h3>
          {userIsPaid ? (
            <>
              <PaidMemberBadge size={18} />
              <PlanTierChip planType={activePlan?.id} />
            </>
          ) : null}
        </div>

        {userIsPaid && activePlan ? (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: 'rgba(0,0,0,0.25)',
              marginBottom: 14,
              border: `1px solid ${activePlan.accent}44`
            }}
          >
            <div style={{ color: T.text, fontSize: 13, lineHeight: 1.6 }}>
              <strong style={{ color: T.white }}>{activePlan.dailyOpens}</strong> trade opens per day · Premium order
              book · Verified badge · +{activePlan.credsBonus} Creds
              {activePlan.fastSupport ? ' · Priority support' : ''}
              <span style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                Plan benefits and your <strong style={{ color: T.green }}>${planStartBalance?.toLocaleString()}</strong>{' '}
                wallet balance are active now.
              </span>
            </div>
            {balanceResetLabel ? (
              <div style={{ marginTop: 10, fontSize: 12, color: T.text, lineHeight: 1.5, opacity: 0.9 }}>
                Next monthly plan balance refresh: <strong>{balanceResetLabel} IST</strong>
              </div>
            ) : null}
            <div style={{ marginTop: 12, fontSize: 13, color: T.text }}>
              Renews / expires:{' '}
              <strong style={{ color: T.white }}>{formatExpiry(expiryIso)}</strong>
            </div>
            <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: daysLeft === 0 ? T.red : '#0095F6' }}>
              {daysLeft === 0 ? 'Plan expired — reverting to Free' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left this cycle`}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: T.text, opacity: 0.85 }}>
              After expiry your account returns to the Free plan automatically.
            </div>
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: `1px solid ${T.border}`,
                fontSize: 13,
                color: T.text,
                lineHeight: 1.55
              }}
            >
              <strong style={{ color: T.white }}>Free account resets:</strong>{' '}
              <span style={{ color: freeResetsLeft > 0 ? T.green : T.red, fontWeight: 800 }}>
                {freeResetsLeft} of {freeResetsLimit} left
              </span>
              <span style={{ display: 'block', fontSize: 11, marginTop: 4, opacity: 0.9 }}>
                Clears all trades & P/L · wallet back to ${planStartBalance?.toLocaleString()} ({planLabel})
              </span>
            </div>
            <div style={{ marginTop: 12 }}>
              <PaidFreeResetButton />
            </div>
          </div>
        ) : (
          <>
            <p style={{ color: T.text, fontSize: 13, lineHeight: 1.55, marginTop: 0, marginBottom: 14 }}>
              Upgrade for more daily trades, verified badge, premium order book, and bonus Creds.
            </p>
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: T.card2,
                border: `1px solid ${T.border}`,
                marginBottom: 12
              }}
            >
              <div style={{ color: T.white, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Free</div>
              <ul style={{ margin: 0, paddingLeft: 16, color: T.text, fontSize: 11, lineHeight: 1.55 }}>
                {FREE_PLAN_FEATURES.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {!userIsPaid ? PLAN_ORDER.map((key) => planCard(key)) : null}
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            background: T.card2,
            border: `1px solid ${T.border}`,
            fontSize: 11,
            color: T.text
          }}
        >
          <div style={{ color: T.white, fontWeight: 800, fontSize: 12, marginBottom: 8 }}>Plan compare</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `1.2fr repeat(${PLAN_ORDER.length}, 1fr)`,
              gap: 8,
              alignItems: 'center'
            }}
          >
            <span />
            {PLAN_ORDER.map((key) => (
              <span key={key} style={{ color: PLAN_CATALOG[key].accent, fontWeight: 800 }}>
                {PLAN_CATALOG[key].label}
              </span>
            ))}
            <span>Free resets</span>
            {PLAN_ORDER.map((key) => (
              <span key={`resets-${key}`}>{PLAN_CATALOG[key].freeResets}</span>
            ))}
            <span>Daily opens</span>
            {PLAN_ORDER.map((key) => (
              <span key={`opens-${key}`}>{PLAN_CATALOG[key].dailyOpens}</span>
            ))}
            <span>Plan wallet</span>
            {PLAN_ORDER.map((key) => (
              <span key={`wallet-${key}`}>${PLAN_CATALOG[key].startBalanceUsd.toLocaleString()}</span>
            ))}
          </div>
        </div>
      </Card>

      {!userIsPaid ? (
        <Card style={{ marginBottom: 20, border: `1px dashed ${T.yellow}` }}>
          <h3 style={{ color: T.white, marginTop: 0, marginBottom: 10, fontSize: 16 }}>Extra trades (rewarded ad)</h3>
          <p style={{ color: T.text, fontSize: 13, marginBottom: 12, lineHeight: 1.45 }}>
            {MAX_DAILY_OPENS} free opens/day. Each ad adds +1 (max {MAX_AD_TRADE_BONUS_SLOTS}/day IST).
          </p>
          <div style={{ color: T.text, fontSize: 12, marginBottom: 12 }}>
            Ad bonuses: {getAdTradeBonusEarned(userData)}/{MAX_AD_TRADE_BONUS_SLOTS} · Max today:{' '}
            {getEffectiveDailyOpenLimit(userData)}
          </div>
          <Btn
            onClick={claimExtraTradeViaAd}
            disabled={tradeAdBusy || getAdTradeBonusEarned(userData) >= MAX_AD_TRADE_BONUS_SLOTS}
            style={{
              width: '100%',
              background: `linear-gradient(135deg, ${T.yellow} 0%, #d9a700 100%)`,
              color: '#000',
              border: 'none',
              fontWeight: 800
            }}
          >
            {tradeAdBusy ? 'Processing…' : `Watch ad for +1 open`}
          </Btn>
          <p style={{ color: T.text, fontSize: 11, marginTop: 10 }}>
            Basic (20/day) or Pro (30/day) — no ads needed.
          </p>
        </Card>
      ) : null}

      <Card style={{ marginBottom: 20, border: `1px dashed ${T.border}` }}>
        <h3 style={{ color: T.white, marginTop: 0, marginBottom: 12, fontSize: 16 }}>
          {userIsPaid ? 'Paid reset (₹50)' : 'Account Reset'}
        </h3>
        <p style={{ color: T.text, fontSize: 13, marginBottom: 14 }}>
          {userIsPaid
            ? `Use your ${freeResetsLeft} free reset${freeResetsLeft === 1 ? '' : 's'} above first. This paid reset clears history and sets balance to $10,000 (not plan tier).`
            : 'Fresh start — history cleared, balance restored to $10,000.'}
        </p>
        <Btn
          onClick={openResetPaymentUpi}
          disabled={resetBusy}
          style={{
            background: `linear-gradient(135deg, ${T.yellow} 0%, #d9a700 100%)`,
            color: '#000',
            border: 'none',
            fontWeight: 800
          }}
        >
          {resetBusy ? 'Processing…' : `Pay ₹${RESET_PRICE_INR} — Reset Account`}
        </Btn>
      </Card>

      <Card>
        <div style={{ color: T.white, fontWeight: 700, marginBottom: 12 }}>Assets</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: '#26A17B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 12
              }}
            >
              ₮
            </div>
            <div>
              <div style={{ color: T.white, fontWeight: 600 }}>USDT</div>
              <div style={{ color: T.text, fontSize: 12 }}>Tether</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', color: T.white, fontWeight: 600 }}>
            {parseFloat(userData?.virtualBalance || 0).toFixed(2)}
          </div>
        </div>
      </Card>
    </div>
  );
};
