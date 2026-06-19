import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebaseClient';
import { AuthContext } from '../authContext';
import { isFirestoreDisabled } from '../config/dataBackend';
import { TIP_CATEGORIES, categoryShort, buildWhatsAppTipUrl, buildAdminPrompt } from './categories';
const T = {
  bg: '#0b0e11',
  card: '#1e2329',
  card2: '#2b3139',
  yellow: '#f0b90b',
  green: '#02c076',
  red: '#f6465d',
  text: '#848e9c',
  white: '#ffffff',
  border: '#2b2f36',
  purple: '#a78bfa'
};

function TipCard({ tip, onView, onQuery }) {
  const img = tip.chart_image_url;
  const trendTag =
    Number(tip.target_price) > Number(tip.entry_price) ? 'Long' : Number(tip.target_price) < Number(tip.entry_price) ? 'Short' : 'View';
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(58,45,126,0.32) 0%, rgba(19,21,30,0.98) 58%, #0a0a0a 100%)',
        borderRadius: 14,
        border: `1px solid rgba(167,139,250,0.28)`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 26px rgba(0,0,0,0.28)'
      }}
    >
      <div style={{ padding: '14px 16px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#bba7ff', fontWeight: 800, letterSpacing: '0.16em', marginBottom: 6 }}>
              DAILY MARKET INSIGHTS
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.white }}>{tip.stock_name}</div>
            <div style={{ fontSize: 12, color: T.text, marginTop: 2 }}>
              {tip.stock_symbol} · {categoryShort(tip.category)}
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: trendTag === 'Long' ? T.green : trendTag === 'Short' ? T.red : T.yellow,
              border: `1px solid ${trendTag === 'Long' ? 'rgba(2,192,118,0.35)' : trendTag === 'Short' ? 'rgba(246,70,93,0.35)' : 'rgba(240,185,11,0.35)'}`,
              padding: '4px 8px',
              borderRadius: 8,
              whiteSpace: 'nowrap'
            }}
          >
            {trendTag.toUpperCase()}
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginTop: 12
          }}
        >
          {[
            ['Entry', tip.entry_price],
            ['Target', tip.target_price],
            ['SL', tip.stop_loss]
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                background: T.card2,
                borderRadius: 8,
                padding: '8px 10px',
                border: `1px solid ${T.border}`
              }}
            >
              <div style={{ fontSize: 10, color: T.text, fontWeight: 600 }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.white, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
        {tip.risk_level && (
          <div style={{ marginTop: 10, fontSize: 11, color: T.text }}>
            Risk:{' '} 
            <span style={{ color: T.yellow, fontWeight: 700 }}>{tip.risk_level}</span>
          </div>
        )}
      </div>
      {img ? (
        <div style={{ width: '100%', maxHeight: 180, overflow: 'hidden', background: '#000' }}>
          <img
            src={img}
            alt={`Chart ${tip.stock_name}`}
            style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
            loading="lazy"
          />
        </div>
      ) : null}
      <div style={{ padding: '10px 16px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <p
          style={{
            color: T.text,
            fontSize: 13,
            lineHeight: 1.45,
            margin: 0,
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {tip.description || '—'}
        </p>
        {Array.isArray(tip.tags) && tip.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {tip.tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 10,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(240,185,11,0.12)',
                  color: T.yellow,
                  fontWeight: 700
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onView(tip)}
            style={{
              flex: 1,
              minWidth: 120,
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: T.card2,
              color: T.white,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            Open Insight
          </button>
          <button
            type="button"
            onClick={() => onQuery(tip)}
            style={{
              flex: 1,
              minWidth: 120,
              padding: '10px 12px',
              borderRadius: 10,
              border: 'none',
              background: `linear-gradient(135deg, ${T.green} 0%, #019e5c 100%)`,
              color: T.white,
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            Ask on this Tip
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExpertTipsScreen() {
  const { user, userData } = useContext(AuthContext);
  const [tab, setTab] = useState('1day');
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listErr, setListErr] = useState('');
  const [detail, setDetail] = useState(null);
  const [queryTip, setQueryTip] = useState(null);
  const [queryText, setQueryText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState('');
  const [gateMsg, setGateMsg] = useState('');
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [tipsAdCountToday, setTipsAdCountToday] = useState(0);
  const [tipsAdUnlockedUntil, setTipsAdUnlockedUntil] = useState(0);
  const [openingUpi, setOpeningUpi] = useState(false);

  const PREMIUM_MONTHLY_INR = 100;
  const ADS_REQUIRED_FOR_24H_UNLOCK = 3;
  const UPI_PAYEE_NAME = 'ATHARVA OMESH DARSHANWAR';
  const UPI_PAYEE_ID = process.env.REACT_APP_PREMIUM_UPI_ID || '';

  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const premiumUntilMs = useMemo(() => {
    const iso = userData?.tipsPremiumUntil;
    if (!iso) return 0;
    const ms = new Date(iso).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }, [userData?.tipsPremiumUntil]);
  const isPremiumActive = premiumUntilMs > Date.now();
  const isAdAccessActive = tipsAdUnlockedUntil > Date.now();
  const hasTipsAccess = isPremiumActive || isAdAccessActive;

  const catMeta = useMemo(() => TIP_CATEGORIES.find((c) => c.id === tab), [tab]);

  useEffect(() => {
    const uid = user?.uid || 'guest';
    const countKey = `tips-ads-count:${uid}:${todayDate}`;
    const untilKey = `tips-unlock-until:${uid}`;
    try {
      const count = Number(localStorage.getItem(countKey) || 0);
      const until = Number(localStorage.getItem(untilKey) || 0);
      setTipsAdCountToday(count);
      setTipsAdUnlockedUntil(until);
    } catch (e) {
      setTipsAdCountToday(0);
      setTipsAdUnlockedUntil(0);
    }
  }, [todayDate, user?.uid]);

  useEffect(() => {
    if (isFirestoreDisabled()) {
      setTips([]);
      setListErr('Expert tips are moving to the new server. Check back after the next update.');
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const qy = query(
      collection(db, 'stockTips'),
      where('category', '==', tab),
      orderBy('created_at', 'desc'),
      limit(40)
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        setTips(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setListErr('');
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        const m = err?.message || '';
        setListErr(
          m.includes('index') || err?.code === 'failed-precondition'
            ? 'Firestore index required: run npm run deploy:indexes (or deploy firestore.indexes.json from Firebase Console link in the error).'
            : m || 'Could not load tips.'
        );
      }
    );
    return unsub;
  }, [tab]);

  const saveQuery = async () => {
    if (!queryTip) return;
    if (!user) {
      setSubmitOk('Login required to save query to Help Centre.');
      return;
    }
    setSubmitting(true);
    setSubmitOk('');
    try {
      const admin_prompt = buildAdminPrompt({
        stock_name: queryTip.stock_name,
        category: queryTip.category,
        entry_price: queryTip.entry_price,
        target_price: queryTip.target_price,
        stop_loss: queryTip.stop_loss,
        user_message: queryText
      });
      const userEmail = user.email || '';
      const userDisplayName =
        (user.displayName && user.displayName.trim()) ||
        (userEmail ? userEmail.split('@')[0] : '') ||
        'Trader';
      await addDoc(collection(db, 'tipQueries'), {
        tip_id: queryTip.id,
        stock_name: queryTip.stock_name,
        category: queryTip.category,
        entry_price: String(queryTip.entry_price),
        target_price: String(queryTip.target_price),
        stop_loss: String(queryTip.stop_loss ?? ''),
        user_message: queryText,
        user_uid: user.uid,
        user_display_name: userDisplayName,
        user_email: userEmail,
        admin_prompt,
        created_at: serverTimestamp()
      });
      setSubmitOk('Saved to Help Centre. You can also WhatsApp us below.');
    } catch (e) {
      setSubmitOk(e?.message || 'Could not save query.');
    }
    setSubmitting(false);
  };

  const watchAdForTips = () => {
    const uid = user?.uid || 'guest';
    const countKey = `tips-ads-count:${uid}:${todayDate}`;
    const untilKey = `tips-unlock-until:${uid}`;
    const next = Math.min(tipsAdCountToday + 1, ADS_REQUIRED_FOR_24H_UNLOCK);
    setTipsAdCountToday(next);
    localStorage.setItem(countKey, String(next));
    if (next >= ADS_REQUIRED_FOR_24H_UNLOCK) {
      const unlockUntil = Date.now() + 24 * 60 * 60 * 1000;
      setTipsAdUnlockedUntil(unlockUntil);
      localStorage.setItem(untilKey, String(unlockUntil));
      setGateMsg('Tips unlocked for next 24 hours. Enjoy!');
      return;
    }
    setGateMsg(`Ad counted (${next}/${ADS_REQUIRED_FOR_24H_UNLOCK}).`);
  };

  const getUpiLink = () => {
    const params = new URLSearchParams({
      pa: UPI_PAYEE_ID,
      pn: UPI_PAYEE_NAME,
      am: String(PREMIUM_MONTHLY_INR),
      cu: 'INR',
      tn: 'AuronX Premium Monthly'
    });
    return `upi://pay?${params.toString()}`;
  };

  const openUpiApp = () => {
    if (!UPI_PAYEE_ID) {
      setGateMsg('UPI not configured yet. Set REACT_APP_PREMIUM_UPI_ID to enable direct app payment.');
      return;
    }
    setOpeningUpi(true);
    setGateMsg('Opening UPI app... Complete payment there. Premium will unlock automatically.');
    window.location.href = getUpiLink();
    window.setTimeout(() => setOpeningUpi(false), 2500);
  };

  return (
    <div style={{ padding: '16px 14px 40px', maxWidth: 1120, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/" style={{ color: T.text, textDecoration: 'none', fontSize: 13 }}>
          ← Home
        </Link>
      </div>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ color: T.white, fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 900, margin: '0 0 8px' }}>
          Daily Market <span style={{ color: T.yellow }}>Insights</span>
        </h1>
        <p style={{ color: T.text, fontSize: 14, lineHeight: 1.55, margin: 0, maxWidth: 640 }}>
          Tips you publish from the developer panel appear here in the same card layout.
        </p>
      </header>

      {!hasTipsAccess && (
        <div
          style={{
            background: `linear-gradient(165deg, ${T.card} 0%, #171b22 100%)`,
            borderRadius: 14,
            border: `1px solid ${T.border}`,
            padding: 18,
            marginBottom: 20
          }}
        >
          <h3 style={{ color: T.white, marginTop: 0, marginBottom: 8 }}>Insights Access Locked</h3>
          <p style={{ color: T.text, fontSize: 13, marginTop: 0, marginBottom: 14 }}>
            Unlock by watching 3 ads (valid for 24h) or take premium for Rs {PREMIUM_MONTHLY_INR}/month.
          </p>
          <div style={{ color: T.text, fontSize: 12, marginBottom: 10 }}>
            Ad progress: {tipsAdCountToday}/{ADS_REQUIRED_FOR_24H_UNLOCK}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              onClick={watchAdForTips}
              style={{
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.card2,
                color: T.white,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Watch 30s Ad ({tipsAdCountToday}/{ADS_REQUIRED_FOR_24H_UNLOCK})
            </button>
            <button
              type="button"
              onClick={() => setPremiumModalOpen(true)}
              style={{
                padding: 12,
                borderRadius: 10,
                border: 'none',
                background: `linear-gradient(135deg, ${T.yellow} 0%, #d9a700 100%)`,
                color: '#000',
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              Go Premium (Rs {PREMIUM_MONTHLY_INR}/month)
            </button>
          </div>
          {gateMsg ? (
            <div style={{ marginTop: 12, fontSize: 13, color: gateMsg.includes('unlock') || gateMsg.includes('Premium') ? T.green : T.red }}>
              {gateMsg}
            </div>
          ) : null}
        </div>
      )}

      {isPremiumActive && (
        <div style={{ marginBottom: 14, color: T.green, fontSize: 13, fontWeight: 700 }}>
          Premium active till {new Date(premiumUntilMs).toLocaleString()} (this account only).
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 20,
          borderBottom: `1px solid ${T.border}`,
          paddingBottom: 4
        }}
      >
        {TIP_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setTab(c.id)}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: tab === c.id ? `1px solid ${T.yellow}` : `1px solid ${T.border}`,
              background: tab === c.id ? 'rgba(240,185,11,0.12)' : T.card,
              color: tab === c.id ? T.white : T.text,
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
              textAlign: 'left',
              maxWidth: '100%'
            }}
          >
            <div>{c.label}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.text, marginTop: 4 }}>{c.hint}</div>
          </button>
        ))}
      </div>

      {catMeta && (
        <p style={{ color: T.text, fontSize: 13, marginBottom: 16 }}>
          Showing: <strong style={{ color: T.white }}>{catMeta.label}</strong>
        </p>
      )}

      {listErr ? (
        <div style={{ color: T.red, padding: 16, background: T.card, borderRadius: 12, fontSize: 14 }}>{listErr}</div>
      ) : null}

      {loading ? (
        <div style={{ color: T.text, padding: 24 }}>Loading tips…</div>
      ) : !hasTipsAccess ? (
        <div
          style={{
            background: T.card,
            borderRadius: 14,
            padding: 28,
            textAlign: 'center',
            color: T.text,
            border: `1px dashed ${T.border}`
          }}
        >
          Access required. Complete 3 ads for 24h unlock or activate premium.
        </div>
      ) : tips.length === 0 ? (
        <div
          style={{
            background: T.card,
            borderRadius: 14,
            padding: 28,
            textAlign: 'center',
            color: T.text,
            border: `1px dashed ${T.border}`
          }}
        >
          No tips in this section yet. Check back soon.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
          {tips.map((tip) => (
            <TipCard key={tip.id} tip={tip} onView={setDetail} onQuery={setQueryTip} />
          ))}
        </div>
      )}

      {detail && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 4000,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 12
          }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{
              background: T.card,
              borderRadius: 16,
              maxWidth: 520,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              border: `1px solid ${T.border}`,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <h2 style={{ margin: 0, color: T.white, fontSize: 20 }}>{detail.stock_name}</h2>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  style={{
                    border: 'none',
                    background: T.card2,
                    color: T.white,
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 18
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ fontSize: 12, color: T.text, marginTop: 6 }}>{detail.stock_symbol}</div>
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  ['Entry', detail.entry_price],
                  ['Target', detail.target_price],
                  ['SL', detail.stop_loss]
                ].map(([k, v]) => (
                  <div key={k} style={{ background: T.card2, padding: 10, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: T.text }}>{k}</div>
                    <div style={{ fontWeight: 800, color: T.white }}>{v}</div>
                  </div>
                ))}
              </div>
              {detail.chart_image_url ? (
                <img
                  src={detail.chart_image_url}
                  alt="Chart"
                  style={{ width: '100%', borderRadius: 10, marginTop: 14 }}
                />
              ) : null}
              <p style={{ color: T.text, fontSize: 14, lineHeight: 1.6, marginTop: 14 }}>{detail.description}</p>
              <button
                type="button"
                onClick={() => {
                  setQueryTip(detail);
                  setDetail(null);
                }}
                style={{
                  marginTop: 16,
                  width: '100%',
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  background: T.green,
                  color: T.white,
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Query this Insight
              </button>
            </div>
          </div>
        </div>
      )}

      {queryTip && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 4001,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 12
          }}
          onClick={() => {
            setQueryTip(null);
            setQueryText('');
            setSubmitOk('');
          }}
        >
          <div
            style={{
              background: T.card,
              borderRadius: 16,
              maxWidth: 480,
              width: '100%',
              border: `1px solid ${T.border}`,
              padding: 18
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', color: T.white }}>Query: {queryTip.stock_name}</h3>
            <p style={{ fontSize: 12, color: T.text, marginBottom: 12 }}>
              Add your question, save to Help Centre (logged-in), and open WhatsApp with the same details.
            </p>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Type your question…"
              rows={5}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.card2,
                color: T.white,
                padding: 12,
                fontSize: 14,
                resize: 'vertical',
                marginBottom: 12
              }}
            />
            {submitOk ? (
              <div style={{ fontSize: 13, color: submitOk.includes('Saved') ? T.green : T.red, marginBottom: 10 }}>
                {submitOk}
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                disabled={submitting}
                onClick={saveQuery}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  background: T.yellow,
                  color: '#000',
                  fontWeight: 800,
                  cursor: submitting ? 'wait' : 'pointer',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? 'Saving…' : 'Submit to Help Centre'}
              </button>
              <a
                href={buildWhatsAppTipUrl({
                  stock_name: queryTip.stock_name,
                  category: queryTip.category,
                  entry_price: queryTip.entry_price,
                  target_price: queryTip.target_price,
                  user_message: queryText
                })}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  textAlign: 'center',
                  padding: 12,
                  borderRadius: 10,
                  background: T.card2,
                  color: T.green,
                  fontWeight: 800,
                  textDecoration: 'none',
                  border: `1px solid rgba(2,192,118,0.35)`
                }}
              >
                Open WhatsApp
              </a>
              <button
                type="button"
                onClick={() => {
                  setQueryTip(null);
                  setQueryText('');
                  setSubmitOk('');
                }}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: 'transparent',
                  color: T.text,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {premiumModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 5000,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setPremiumModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 360,
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: 16
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, color: T.white }}>Premium Payment</h3>
            <p style={{ color: T.text, fontSize: 12, marginTop: 8 }}>
              Tap below to open PhonePe / GPay / any UPI app directly. Premium unlocks automatically after payment confirmation.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <button
                type="button"
                onClick={openUpiApp}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  background: `linear-gradient(135deg, ${T.yellow} 0%, #d9a700 100%)`,
                  color: '#000',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                Open UPI Apps (PhonePe / GPay / BHIM)
              </button>
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: T.card2,
                  color: T.text,
                  fontSize: 13,
                  textAlign: 'center',
                  fontWeight: 700
                }}
              >
                {openingUpi ? 'Opening app...' : 'Waiting for payment confirmation...'}
              </div>
              <button
                type="button"
                onClick={() => setPremiumModalOpen(false)}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: 'transparent',
                  color: T.text,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
