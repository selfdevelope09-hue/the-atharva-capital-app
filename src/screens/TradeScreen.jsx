import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { doc, runTransaction } from 'firebase/firestore';
import { AuthContext } from '../authContext';
import { db } from '../firebaseClient';
import {
  activateBffQuotaFallback,
  isBffTradeMode,
  isFirestoreDisabled,
  isSupabaseFallbackEnabled
} from '../config/dataBackend';
import { isRealtimeTradeMode } from '../config/tradeBackend';
import { bffTrade } from '../api/serverBff';
import { useTradeSocket } from '../hooks/useTradeSocket';
import { useRealtimeTicks } from '../hooks/useRealtimeTicks';
import { shouldFallbackFromFirestoreToSupabase } from '../utils/firestoreQuota';
import { useHotPrices } from '../hooks/useHotPrices';
import { lookupLivePrice, normalizeBinanceSymbol, parseLiveMarkPrice } from '../utils/marketSymbol';
import { TRADING_PAIRS_USDT } from '../config/tradingPairs';
import { T } from '../app/theme';
import { Card, Input, Btn } from '../components/ui/AppPrimitives';
import { quantityFromNotional, openFeeUsdt, liquidationPrice, liquidationMovePct } from '../tradingEngine';
import TradeChart from '../components/TradeChart';
import { fmtQuoteVol, genPositionId } from '../utils/positionUtils';
import { coerceJsonArray } from '../utils/userDoc';
import { ensureFirestoreUserDoc } from '../utils/ensureFirestoreUser';
import {
  MAX_DAILY_OPENS,
  MAX_AD_TRADE_BONUS_SLOTS,
  getDailyOpenTradesRemaining,
  getDailyOpenTradesUsed,
  getEffectiveDailyOpenLimit,
  getBaseDailyOpenLimit,
  isPaidMember,
  tradingDayKey,
  BASIC_DAILY_OPENS
} from '../utils/tradingDayLimit';
import { getPlanConfig } from '../config/paidPlan';
import { withTradeAsBody } from '../utils/chatAsUid';
import { DAILY_FULL_TRADES_USD_BONUS, DAILY_OPENS_TARGET_FOR_USD_BONUS } from '../utils/rewardConstants';
import { useDocumentVisible } from '../hooks/useDocumentVisible';

function formatTradeError(e) {
  const code = e?.code || '';
  const msg = String(e?.message || '');
  if (
    msg &&
    !/^order could not be placed\. please retry\.?$/i.test(msg.trim()) &&
    !/^failed to fetch$/i.test(msg)
  ) {
    return msg;
  }
  if (/daily trade limit/i.test(msg)) {
    return `Daily open limit reached (max ${MAX_DAILY_OPENS} + up to ${MAX_AD_TRADE_BONUS_SLOTS} from Wallet ads). Resets tomorrow (IST).`;
  }
  if (code === 'resource-exhausted' || /quota exceeded/i.test(msg)) {
    return 'Order could not be placed right now. Please try again shortly.';
  }
  if (code === 'permission-denied' || /permission/i.test(msg)) {
    return 'Order placement permission failed. Please sign in again and retry.';
  }
  if (/insufficient balance/i.test(msg)) return 'Insufficient balance.';
  return 'Order could not be placed. Please retry.';
}

function TradeDepthPanel({ symbol, compact, premium, pollingEnabled = true }) {
  /** asks: ascending from Binance (best / lowest ask first) */
  const [asksAsc, setAsksAsc] = useState([]);
  const [bids, setBids] = useState([]);
  const [vol24hQuote, setVol24hQuote] = useState(null);
  const [depthErr, setDepthErr] = useState(false);
  const depthLimit = premium ? 10 : 20;
  const rowCap = premium ? 6 : 12;
  const pollMs = premium ? 8000 : 2800;

  useEffect(() => {
    if (!pollingEnabled) return undefined;
    let cancelled = false;
    const loadDepth = async () => {
      try {
        const dRes = await fetch(
          `https://api.binance.com/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=${depthLimit}`
        );
        if (!dRes.ok) throw new Error('depth');
        const d = await dRes.json();
        if (cancelled) return;
        setDepthErr(false);
        if (Array.isArray(d.asks) && Array.isArray(d.bids)) {
          setAsksAsc(d.asks.slice(0, rowCap));
          setBids(d.bids.slice(0, rowCap));
        }
      } catch {
        if (!cancelled) setDepthErr(true);
      }
    };
    const loadVol = async () => {
      try {
        const tRes = await fetch(
          `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`
        );
        if (!tRes.ok) return;
        const t = await tRes.json();
        if (!cancelled && t.quoteVolume != null) setVol24hQuote(parseFloat(t.quoteVolume));
      } catch {
        /* decorative */
      }
    };
    loadDepth();
    loadVol();
    const id = setInterval(loadDepth, pollMs);
    const volId = premium ? window.setInterval(loadVol, 60000) : null;
    return () => {
      cancelled = true;
      clearInterval(id);
      if (volId != null) clearInterval(volId);
    };
  }, [symbol, depthLimit, rowCap, pollMs, premium, pollingEnabled]);

  const row = (price, qty, color, key) => {
    const p = parseFloat(price);
    const q = parseFloat(qty);
    const usd = p * q;
    return (
      <div
        key={key}
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr 0.75fr 0.85fr' : '1fr 0.8fr 0.9fr',
          gap: 6,
          fontSize: compact ? 11 : 12,
          padding: '3px 0',
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        <span style={{ color, fontWeight: 600 }}>{p.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        <span style={{ color: T.white }}>{q.toFixed(4)}</span>
        <span style={{ color: T.text }}>{usd >= 1000 ? `$${(usd / 1000).toFixed(1)}k` : `$${usd.toFixed(0)}`}</span>
      </div>
    );
  };

  const askDisplay = asksAsc.slice().reverse();
  const bidSlice = bids;
  const bestAsk = asksAsc.length ? parseFloat(asksAsc[0][0]) : null;
  const bestBid = bids.length ? parseFloat(bids[0][0]) : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        flex: compact ? '1 1 auto' : undefined
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          flexShrink: 0
        }}
      >
        <span style={{ color: T.text, fontSize: 11, fontWeight: 700 }}>
          {premium ? (
            <span style={{ color: '#3897f0' }}>Premium order book</span>
          ) : (
            'Order book'
          )}
          {premium ? (
            <span style={{ color: T.text, fontSize: 9, marginLeft: 6, fontWeight: 500 }}>(display)</span>
          ) : null}
        </span>
        <span style={{ color: T.text, fontSize: 10 }}>
          24h vol:{' '}
          <span style={{ color: T.yellow, fontWeight: 700 }}>
            {vol24hQuote != null ? `$${fmtQuoteVol(vol24hQuote)}` : '—'}
          </span>
        </span>
      </div>
      <div
        style={{
          fontSize: 10,
          color: T.text,
          display: 'grid',
          gridTemplateColumns: compact ? '1fr 0.75fr 0.85fr' : '1fr 0.8fr 0.9fr',
          gap: 6,
          marginBottom: 4,
          fontWeight: 600
        }}
      >
        <span>Price (USDT)</span>
        <span style={{ textAlign: 'right' }}>Size</span>
        <span style={{ textAlign: 'right' }}>Total $</span>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: compact ? 100 : 120,
          maxHeight: compact ? 200 : 320,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          marginBottom: 6
        }}
      >
        {depthErr ? (
          <div style={{ color: T.text, fontSize: 12, padding: '8px 0' }}>Depth offline — retrying…</div>
        ) : (
          <>
            {askDisplay.map((a, i) => row(a[0], a[1], T.red, `a-${i}`))}
            <div
              style={{
                textAlign: 'center',
                padding: '6px 0',
                margin: '4px 0',
                borderTop: `1px solid ${T.border}`,
                borderBottom: `1px solid ${T.border}`,
                color: T.white,
                fontWeight: 800,
                fontSize: 12,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {bestAsk != null && bestBid != null
                ? `${((bestAsk + bestBid) / 2).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                : '—'}
            </div>
            {bidSlice.map((b, i) => row(b[0], b[1], T.green, `b-${i}`))}
          </>
        )}
      </div>
    </div>
  );
}

// -------------------- Trade order form (shared: desktop panel + mobile sheet) --------------------
function TradeOrderFormFields({
  orderType,
  setOrderType,
  side,
  setSide,
  userData,
  limitPrice,
  setLimitPrice,
  amount,
  setAmount,
  leverage,
  setLeverage,
  tp,
  setTp,
  sl,
  setSl,
  msg,
  currentPrice,
  user,
  handleTrade,
  loading,
  symbol,
  dailyOpensUsed,
  dailyOpensRemaining,
  dailyOpensAtLimit,
  dailyOpensEffectiveLimit,
  userIsPaid
}) {
  const priceReady = Number.isFinite(currentPrice) && currentPrice > 0;
  const entryPx =
    orderType === 'Market'
      ? currentPrice
      : parseFloat(String(limitPrice || '').replace(/,/g, '')) || currentPrice;
  const posType = side === 'BUY' ? 'LONG' : 'SHORT';
  const estLiq =
    priceReady && Number.isFinite(entryPx) && entryPx > 0
      ? liquidationPrice(posType, entryPx, leverage)
      : NaN;
  const estLiqMove =
    priceReady && Number.isFinite(entryPx) && entryPx > 0
      ? liquidationMovePct(posType, entryPx, leverage)
      : NaN;
  return (
    <>
      <div
        style={{
          display: 'flex',
          backgroundColor: T.card2,
          borderRadius: 8,
          marginBottom: 14,
          border: `1px solid ${T.border}`
        }}
      >
        {['Market', 'Limit'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setOrderType(t)}
            style={{
              flex: 1,
              padding: 8,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              backgroundColor: orderType === t ? T.yellow : 'transparent',
              color: orderType === t ? '#000' : T.text,
              fontWeight: 600,
              fontSize: 13
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          backgroundColor: T.card2,
          borderRadius: 8,
          marginBottom: 14,
          border: `1px solid ${T.border}`
        }}
      >
        <button
          type="button"
          onClick={() => setSide('BUY')}
          style={{
            flex: 1,
            padding: 10,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            backgroundColor: side === 'BUY' ? T.green : 'transparent',
            color: T.white,
            fontWeight: 700,
            fontSize: 14
          }}
        >
          Buy / Long
        </button>
        <button
          type="button"
          onClick={() => setSide('SELL')}
          style={{
            flex: 1,
            padding: 10,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            backgroundColor: side === 'SELL' ? T.red : 'transparent',
            color: T.white,
            fontWeight: 700,
            fontSize: 14
          }}
        >
          Sell / Short
        </button>
      </div>
      <div style={{ color: T.text, fontSize: 12, marginBottom: 10 }}>
        Available:{' '}
        <span style={{ color: T.white }}>
          {userData
            ? `$${Number(userData.virtualBalance || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} USDT`
            : user
              ? 'Loading balance…'
              : '—'}
        </span>
      </div>
      {!priceReady ? (
        <div style={{ color: T.red, fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>
          Live price loading… Wait a few seconds or check your connection before placing an order.
        </div>
      ) : null}
      {user && userData && (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${dailyOpensAtLimit ? T.red : T.border}`,
            background: dailyOpensAtLimit ? 'rgba(246,70,93,0.12)' : T.card2,
            fontSize: 12,
            lineHeight: 1.45,
            color: T.text
          }}
        >
          <span style={{ color: T.yellow, fontWeight: 800 }}>Today’s limit (max {dailyOpensEffectiveLimit}) · </span>
          {dailyOpensAtLimit ? (
            <span style={{ color: T.red, fontWeight: 700 }}>
              Daily open cap reached — more opens tomorrow (IST).
            </span>
          ) : dailyOpensUsed === 0 ? (
            <span>
              <span style={{ color: T.white, fontWeight: 700 }}>0</span> opens used today — up to{' '}
              <span style={{ color: T.green, fontWeight: 800 }}>{dailyOpensEffectiveLimit}</span> opens
              {userIsPaid ? (
                <span style={{ color: '#3897f0', fontWeight: 700 }}> (Paid plan)</span>
              ) : (
                <> ({MAX_DAILY_OPENS} free + ad slots)</>
              )}
              .
            </span>
          ) : (
            <span>
              <span style={{ color: T.white, fontWeight: 700 }}>{dailyOpensUsed}</span>{' '}
              {dailyOpensUsed === 1 ? 'open' : 'opens'} used —{' '}
              <span style={{ color: T.green, fontWeight: 800 }}>{dailyOpensRemaining}</span> left today.
            </span>
          )}
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 6 }}>
            Only <strong style={{ color: T.white }}>opening</strong> a position counts; closes are unlimited.
            Resets at IST midnight.
            {userIsPaid ? (
              <> Premium members get {getPlanConfig(userData)?.dailyOpens ?? BASIC_DAILY_OPENS} opens/day.</>
            ) : (
              <> Need more opens? Wallet → rewarded ad (up to +{MAX_AD_TRADE_BONUS_SLOTS} / day).</>
            )}
          </div>
        </div>
      )}
      {orderType === 'Limit' && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>
            Limit Price
          </label>
          <Input
            placeholder={currentPrice.toFixed(2)}
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            type="number"
          />
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>
          Amount (USDT)
        </label>
        <Input
          placeholder="e.g. 100"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {[25, 50, 100].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => {
                const bal = Number(userData?.virtualBalance || 0);
                const v = (bal * pct) / 100;
                setAmount(v > 0 ? v.toFixed(2) : '');
              }}
              style={{
                border: `1px solid ${T.border}`,
                background: T.card2,
                color: T.text,
                borderRadius: 7,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 6 }}>
          Leverage: <span style={{ color: T.yellow, fontWeight: 700 }}>{leverage}x</span>
        </label>
        <input
          type="range"
          min={1}
          max={125}
          value={leverage}
          onChange={(e) => setLeverage(parseInt(e.target.value, 10))}
          style={{ width: '100%', accentColor: T.yellow }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {[1, 5, 10, 25, 50, 100, 125].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setLeverage(v)}
              style={{
                background: 'none',
                border: 'none',
                color: leverage === v ? T.yellow : T.text,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: leverage === v ? 700 : 400
              }}
            >
              {v}x
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginBottom: 14
        }}
      >
        <div>
          <label style={{ color: T.text, fontSize: 11, display: 'block', marginBottom: 4 }}>
            Take Profit
          </label>
          <Input
            placeholder="Optional"
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            type="number"
          />
        </div>
        <div>
          <label style={{ color: T.text, fontSize: 11, display: 'block', marginBottom: 4 }}>
            Stop Loss
          </label>
          <Input
            placeholder="Optional"
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            type="number"
          />
        </div>
      </div>
      {amount && !isNaN(amount) && parseFloat(amount) > 0 && (
        <div
          style={{
            backgroundColor: T.card2,
            borderRadius: 6,
            padding: '10px 12px',
            marginBottom: 12,
            fontSize: 12
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: T.text }}>Position Size</span>
            <span style={{ color: T.white }}>${parseFloat(amount).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: T.text }}>Margin Required</span>
            <span style={{ color: T.yellow }}>${(parseFloat(amount) / leverage).toFixed(2)}</span>
          </div>
          {Number.isFinite(estLiq) ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: T.text }}>Est. Liq. Price</span>
                <span style={{ color: T.red, fontWeight: 700 }}>
                  ${estLiq.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
              </div>
              {Number.isFinite(estLiqMove) ? (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: T.text }}>Move to liq.</span>
                  <span style={{ color: T.text }}>
                    ~{estLiqMove.toFixed(2)}% {posType === 'LONG' ? '↓' : '↑'}
                  </span>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      )}
      {msg && (
        <div
          style={{
            backgroundColor:
              msg.t === 'success' ? 'rgba(2,192,118,0.15)' : 'rgba(246,70,93,0.15)',
            color: msg.t === 'success' ? T.green : T.red,
            padding: '10px 12px',
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 12
          }}
        >
          {msg.m}
        </div>
      )}
      {user ? (
        <Btn
          color={side === 'BUY' ? T.green : T.red}
          onClick={handleTrade}
          disabled={loading || dailyOpensAtLimit || !priceReady}
        >
          {dailyOpensAtLimit
            ? 'Daily limit reached'
            : !priceReady
              ? 'Waiting for price…'
            : loading
              ? 'Opening...'
              : `${side === 'BUY' ? 'Buy / Long' : 'Sell / Short'} ${symbol.replace('USDT', '')}`}
        </Btn>
      ) : (
        <Link
          to="/login"
          style={{
            display: 'block',
            textAlign: 'center',
            backgroundColor: T.yellow,
            color: '#000',
            padding: 13,
            borderRadius: 6,
            fontWeight: 'bold',
            textDecoration: 'none'
          }}
        >
          Login to Trade
        </Link>
      )}
    </>
  );
}

function TradeScreenInner() {
  const hotPrices = useHotPrices();
  const socketTicks = useRealtimeTicks(TRADING_PAIRS_USDT);
  const prices = isRealtimeTradeMode() ? { ...hotPrices, ...socketTicks } : hotPrices;
  const { user, userData, refreshUser, isActingAsShowcase, actingAsUid } = useContext(AuthContext);
  const { openTrade: socketOpenTrade, busy: socketTradeBusy } = useTradeSocket();
  const tradeOwnerUid = user?.uid;
  const navigate = useNavigate();
  const location = useLocation();
  const docVisible = useDocumentVisible();
  const tradeRouteActive = location.pathname === '/trade' && docVisible;

  const initialSym = useMemo(() => {
    const q = new URLSearchParams(location.search).get('symbol');
    if (q) return q.toUpperCase();
    const h = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const hq = new URLSearchParams(h).get('symbol');
    return hq ? hq.toUpperCase() : 'BTCUSDT';
  }, [location.search]);

  const [symbol, setSymbol] = useState(initialSym);
  const [orderType, setOrderType] = useState('Market');
  const [side, setSide] = useState('BUY');
  const [amount, setAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fullscreenChart, setFullscreenChart] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('focus') === 'chart';
    } catch {
      return false;
    }
  });
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 640
  );
  const [fsViewportH, setFsViewportH] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 800
  );

  useEffect(() => {
    setSymbol(initialSym);
  }, [initialSym]);

  /** Dashboard open position → trade?focus=chart: open chart fullscreen and strip param so refresh stays sane. */
  useLayoutEffect(() => {
    const sp = new URLSearchParams(location.search);
    if (sp.get('focus') !== 'chart') return;
    setFullscreenChart(true);
    sp.delete('focus');
    const q = sp.toString();
    navigate(`${location.pathname}${q ? `?${q}` : ''}`, { replace: true });
  }, [location.search, location.pathname, navigate]);

  const chartScrollAnchorRef = useRef(null);
  /** When not fullscreen (e.g. user closed overlay), still scroll chart into view if focus was requested before strip. */
  useLayoutEffect(() => {
    const focus = new URLSearchParams(location.search).get('focus');
    if (focus !== 'chart') return undefined;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      chartScrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    run();
    const ids = [0, 80, 240, 500].map((ms) => window.setTimeout(run, ms));
    return () => {
      cancelled = true;
      ids.forEach((id) => window.clearTimeout(id));
    };
  }, [location.search, symbol]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const fn = () => setIsNarrow(mq.matches);
    mq.addEventListener('change', fn);
    fn();
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    if (!fullscreenChart) return;
    document.body.classList.add('trade-chart-fullscreen-active');
    document.body.style.overflow = 'hidden';
    const onResize = () => setFsViewportH(window.innerHeight);
    onResize();
    window.addEventListener('resize', onResize);
    const onKey = (e) => {
      if (e.key === 'Escape') setFullscreenChart(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('trade-chart-fullscreen-active');
      document.body.style.overflow = '';
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreenChart]);

  const tradeSymbol = normalizeBinanceSymbol(symbol);
  const liveData = lookupLivePrice(prices, tradeSymbol) || {};
  const currentPrice = parseLiveMarkPrice(liveData) || 0;
  const execPrice = orderType === 'Market' ? currentPrice : parseFloat(limitPrice || currentPrice);
  const popularPairs = TRADING_PAIRS_USDT;

  const userIsPaid = useMemo(() => isPaidMember(userData), [userData]);
  const dailyOpensUsed = useMemo(() => getDailyOpenTradesUsed(userData), [userData]);
  const dailyOpensRemaining = useMemo(() => getDailyOpenTradesRemaining(userData), [userData]);
  const dailyOpensEffectiveLimit = useMemo(() => getEffectiveDailyOpenLimit(userData), [userData]);
  const dailyOpensAtLimit =
    !isActingAsShowcase &&
    !!user &&
    !!userData &&
    dailyOpensUsed >= getEffectiveDailyOpenLimit(userData);

  const handleTrade = async () => {
    if (!user) return navigate('/login');
    if (
      !isActingAsShowcase &&
      userData &&
      getDailyOpenTradesUsed(userData) >= getEffectiveDailyOpenLimit(userData)
    ) {
      setMsg({
        t: 'error',
        m: formatTradeError(new Error('Daily trade limit reached'))
      });
      return;
    }
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0)
      return setMsg({ t: 'error', m: 'Enter a valid amount.' });
    if (!Number.isFinite(execPrice) || execPrice <= 0) {
      return setMsg({
        t: 'error',
        m: 'Live price not loaded yet. Wait a few seconds or check your connection, then retry.'
      });
    }
    const amt = parseFloat(amount);
    const marginReq = amt / leverage;
    const feeRate = 0;
    const openFee = openFeeUsdt(amt, orderType === 'Market');
    const qtyOpen = quantityFromNotional(amt, execPrice);
    const totalDebit = marginReq + openFee;
    if (totalDebit > (userData?.virtualBalance || 0))
      return setMsg({
        t: 'error',
        m: `Insufficient balance. Need $${marginReq.toFixed(2)} margin.`
      });

    setLoading(true);
    const tradeBody = withTradeAsBody(
      {
        symbol,
        side,
        leverage,
        amount: amt,
        execPrice,
        orderType,
        tp,
        sl
      },
      actingAsUid,
      isActingAsShowcase
    );
    try {
      if (isRealtimeTradeMode()) {
        const j = await socketOpenTrade(tradeBody);
        const bonusLine =
          j?.twelveTradeBonusUsd > 0
            ? ` 🎁 +$${Number(j.twelveTradeBonusUsd).toLocaleString()} daily grind bonus wallet me add!`
            : '';
        setMsg({
          t: 'success',
          m: `✅ ${side === 'BUY' ? 'LONG' : 'SHORT'} ${symbol} at $${execPrice.toFixed(2)}${bonusLine}`
        });
        setAmount('');
        setTp('');
        setSl('');
        if (window.matchMedia('(max-width: 768px)').matches) setOrderSheetOpen(false);
        setLoading(false);
        return;
      }
      if (isBffTradeMode()) {
        const j = await bffTrade('/api/trade/open', {
          method: 'POST',
          body: JSON.stringify(tradeBody)
        });
        const bonusLine =
          j?.twelveTradeBonusUsd > 0
            ? ` 🎁 +$${Number(j.twelveTradeBonusUsd).toLocaleString()} daily grind bonus wallet me add!`
            : '';
        setMsg({
          t: 'success',
          m: `✅ ${side === 'BUY' ? 'LONG' : 'SHORT'} ${symbol} at $${execPrice.toFixed(2)}${bonusLine}`
        });
        setAmount('');
        setTp('');
        setSl('');
        if (window.matchMedia('(max-width: 768px)').matches) setOrderSheetOpen(false);
        setLoading(false);
        refreshUser().catch(() => {});
        window.dispatchEvent(new CustomEvent('auron-leaderboard-reload'));
        window.dispatchEvent(new CustomEvent('auron-firestore-user-sync'));
        return;
      }
      if (isFirestoreDisabled()) {
        throw new Error('Trading backend unavailable. Refresh the page and try again.');
      }
      if (!tradeOwnerUid) throw new Error('Not signed in');
      await ensureFirestoreUserDoc(tradeOwnerUid);
      const userRef = doc(db, 'users', tradeOwnerUid);
      let firestoreTwelveBonus = 0;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          firestoreTwelveBonus = await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw new Error('User does not exist!');
            const raw = userDoc.data();
            const existingPositions = coerceJsonArray(raw.positions);
            const dayKey = tradingDayKey();
            let dCount = Number(raw.dailyTradesCount) || 0;
            let adB = Number(raw.dailyAdTradeBonus) || 0;
            const dSaved = raw.dailyTradesDate != null ? String(raw.dailyTradesDate).slice(0, 10) : '';
            if (dSaved !== dayKey) {
              dCount = 0;
              adB = 0;
            } else if (!raw.isPaidMember) {
              adB = Math.min(MAX_AD_TRADE_BONUS_SLOTS, Math.max(0, adB));
            } else {
              adB = 0;
            }
            const allowed = getBaseDailyOpenLimit(raw) + adB;
            if (dCount >= allowed) throw new Error('Daily trade limit reached');
            const currentBalance = Number(raw.virtualBalance);
            if (!Number.isFinite(currentBalance)) {
              throw new Error('Invalid wallet balance. Refresh the page and try again.');
            }
            if (totalDebit > currentBalance) throw new Error('Insufficient balance.');
            let claimDate =
              raw.dailyTwelveRewardClaimedDate != null
                ? String(raw.dailyTwelveRewardClaimedDate).slice(0, 10)
                : '';
            if (dSaved !== dayKey) claimDate = '';
            const newCount = dCount + 1;
            const claimedForToday = claimDate === dayKey;
            let twelveBonus = 0;
            let nextClaim = claimDate;
            if (newCount >= DAILY_OPENS_TARGET_FOR_USD_BONUS && !claimedForToday) {
              twelveBonus = DAILY_FULL_TRADES_USD_BONUS;
              nextClaim = dayKey;
            }
            const newPosition = {
              positionId: genPositionId(),
              symbol,
              type: side === 'BUY' ? 'LONG' : 'SHORT',
              entryPrice: execPrice,
              leverage,
              margin: marginReq,
              totalSize: amt,
              quantity: qtyOpen,
              openFee,
              feeRate,
              tp: tp ? parseFloat(tp) : null,
              sl: sl ? parseFloat(sl) : null,
              status: 'OPEN',
              time: new Date().toISOString()
            };
            transaction.update(userRef, {
              virtualBalance: currentBalance - totalDebit + twelveBonus,
              positions: [...existingPositions, newPosition],
              dailyTradesDate: dayKey,
              dailyTradesCount: newCount,
              dailyAdTradeBonus: adB,
              dailyTwelveRewardClaimedDate: nextClaim || ''
            });
            return twelveBonus;
          });
          break;
        } catch (err) {
          if (shouldFallbackFromFirestoreToSupabase(err)) throw err;
          const code = String(err?.code || '');
          const transient = code === 'aborted' || code === 'unavailable' || code === 'deadline-exceeded';
          if (!transient || attempt === 2) throw err;
          await new Promise((resolve) => setTimeout(resolve, 260 * (attempt + 1)));
        }
      }
      const fsBonus =
        firestoreTwelveBonus > 0
          ? ` 🎁 +$${Number(firestoreTwelveBonus).toLocaleString()} daily grind bonus wallet me add!`
          : '';
      setMsg({
        t: 'success',
        m: `✅ ${side === 'BUY' ? 'LONG' : 'SHORT'} ${symbol} at $${execPrice.toFixed(2)}${fsBonus}`
      });
      setAmount('');
      setTp('');
      setSl('');
      if (window.matchMedia('(max-width: 768px)').matches) setOrderSheetOpen(false);
      refreshUser().catch(() => {});
      window.dispatchEvent(new CustomEvent('auron-firestore-user-sync'));
    } catch (e) {
      if (isRealtimeTradeMode() && isBffTradeMode()) {
        try {
          const j2 = await bffTrade('/api/trade/open', {
            method: 'POST',
            body: JSON.stringify(tradeBody)
          });
          await refreshUser();
          const bonusLine =
            j2?.twelveTradeBonusUsd > 0
              ? ` 🎁 +$${Number(j2.twelveTradeBonusUsd).toLocaleString()} daily grind bonus wallet me add!`
              : '';
          setMsg({
            t: 'success',
            m: `✅ ${side === 'BUY' ? 'LONG' : 'SHORT'} ${symbol} at $${execPrice.toFixed(2)}${bonusLine}`
          });
          setAmount('');
          setTp('');
          setSl('');
          if (window.matchMedia('(max-width: 768px)').matches) setOrderSheetOpen(false);
          setLoading(false);
          return;
        } catch (httpErr) {
          setMsg({ t: 'error', m: formatTradeError(httpErr) });
          setLoading(false);
          return;
        }
      }
      if (!isBffTradeMode() && shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) {
        try {
          activateBffQuotaFallback();
          const j2 = await bffTrade('/api/trade/open', {
            method: 'POST',
            body: JSON.stringify(tradeBody)
          });
          await refreshUser();
          const bonusLine2 =
            j2?.twelveTradeBonusUsd > 0
              ? ` 🎁 +$${Number(j2.twelveTradeBonusUsd).toLocaleString()} daily grind bonus wallet me add!`
              : '';
          setMsg({
            t: 'success',
            m: `✅ ${side === 'BUY' ? 'LONG' : 'SHORT'} ${symbol} at $${execPrice.toFixed(2)}${bonusLine2}`
          });
          setAmount('');
          setTp('');
          setSl('');
          if (window.matchMedia('(max-width: 768px)').matches) setOrderSheetOpen(false);
        } catch (e2) {
          setMsg({ t: 'error', m: formatTradeError(e2) });
        }
        setLoading(false);
        return;
      }
      setMsg({ t: 'error', m: formatTradeError(e) });
    }
    setLoading(false);
  };

  const showSidePanel = !isNarrow && !fullscreenChart;
  const shellStyle = fullscreenChart
    ? {
        background: T.bg
      }
    : isNarrow
      ? {
          width: '100%',
          boxSizing: 'border-box',
          padding: `10px 10px max(88px, calc(14px + env(safe-area-inset-bottom, 0px)))`,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
          overflowY: 'visible'
        }
      : {
          width: '100%',
          boxSizing: 'border-box',
          padding: '14px clamp(12px, 2vw, 28px) 28px',
          minHeight: 'calc(100dvh - var(--app-header-offset, 56px))'
        };

  const chartIframeMin = fullscreenChart
    ? Math.max(280, fsViewportH - (isNarrow ? 132 : 112))
    : isNarrow
      ? Math.min(480, Math.max(260, typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.48) : 320))
      : Math.max(520, typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.62) : 520);

  return (
    <div className={fullscreenChart ? 'trade-fullscreen-shell' : undefined} style={shellStyle}>
      <div
        className={fullscreenChart ? 'trade-fullscreen-pairs' : undefined}
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'nowrap',
          alignItems: 'center',
          marginBottom: fullscreenChart ? 0 : 14,
          padding: fullscreenChart ? undefined : '4px 4px 0',
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          touchAction: 'pan-x',
          flexShrink: 0
        }}
      >
        <span
          style={{
            color: T.yellow,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 2,
            marginRight: 4,
            flexShrink: 0
          }}
        >
          ⚡
        </span>
        {popularPairs.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSymbol(s);
              navigate(`/trade?symbol=${encodeURIComponent(s)}`, { replace: true });
            }}
            style={{
              backgroundColor: symbol === s ? T.yellow : 'transparent',
              color: symbol === s ? '#000' : T.white,
              border: `1px solid ${symbol === s ? T.yellow : T.border}`,
              padding: isNarrow ? '8px 12px' : '7px 14px',
              borderRadius: 999,
              cursor: 'pointer',
              fontWeight: symbol === s ? 700 : 500,
              fontSize: isNarrow ? 12 : 13,
              flexShrink: 0
            }}
          >
            {s.replace('USDT', '')}/USDT
          </button>
        ))}
        <Link
          to="/markets"
          style={{
            color: T.yellow,
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: 700,
            padding: '8px 10px',
            borderRadius: 999,
            border: `1px dashed ${T.border}`,
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          + More
        </Link>
      </div>
      <div
        ref={chartScrollAnchorRef}
        className={fullscreenChart ? 'trade-fullscreen-chart-grid' : undefined}
        style={{
          flex: fullscreenChart || isNarrow ? 1 : undefined,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: showSidePanel ? 'minmax(0, 1fr) minmax(280px, 400px)' : '1fr',
          gap: fullscreenChart ? 8 : isNarrow ? 10 : 18,
          alignItems: 'stretch',
          padding: fullscreenChart ? 0 : 0,
          overflow: isNarrow && !fullscreenChart ? 'visible' : 'hidden'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isNarrow && !fullscreenChart ? 10 : 0,
            minHeight: 0,
            flex: fullscreenChart || isNarrow ? 1 : undefined,
            overflow: isNarrow && !fullscreenChart ? 'visible' : 'hidden'
          }}
        >
        <Card
          style={{
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            flex: fullscreenChart || isNarrow ? 1 : undefined,
            border: `1px solid rgba(240, 185, 11, 0.22)`,
            borderRadius: fullscreenChart ? 10 : 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
          }}
        >
          <div
              style={{
                padding: fullscreenChart ? '10px 12px' : '12px 18px',
                borderBottom: `1px solid ${T.border}`,
                display: 'flex',
                gap: fullscreenChart ? 10 : 18,
                alignItems: 'center',
                flexWrap: 'wrap',
                flexShrink: 0,
                background: 'linear-gradient(90deg, #1a1e24 0%, #232a33 45%, #1a1e24 100%)'
              }}
            >
              <span style={{ color: T.white, fontWeight: 800, fontSize: fullscreenChart ? 14 : 16 }}>
                {symbol.replace('USDT', '')}/USDT
              </span>
              <span style={{ color: T.green, fontWeight: 800, fontSize: fullscreenChart ? 15 : 18 }}>
                ${currentPrice.toLocaleString()}
              </span>
              <span
                style={{
                  color: parseFloat(liveData.change) >= 0 ? T.green : T.red,
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                {parseFloat(liveData.change) >= 0 ? '+' : ''}
                {liveData.change || '0.00'}%
              </span>
              <button
                type="button"
                onClick={() => setFullscreenChart((v) => !v)}
                style={{
                  marginLeft: 'auto',
                  background: 'linear-gradient(180deg, #2b3139, #1e2329)',
                  border: `1px solid ${T.yellow}`,
                  color: T.yellow,
                  padding: isNarrow ? '8px 12px' : '6px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: isNarrow ? 11 : 12,
                  fontWeight: 700,
                  flexShrink: 0
                }}
              >
                {fullscreenChart ? 'Exit' : isNarrow ? 'Full' : 'Full screen'}
              </button>
            </div>
          <div
            className="trade-tv-wrap trade-tv-wrap--rounded"
            style={
              fullscreenChart
                ? {
                    width: '100%',
                    flex: 1,
                    minHeight: Math.max(240, fsViewportH - (isNarrow ? 132 : 112)),
                    position: 'relative',
                    borderRadius: '0 0 10px 10px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }
                : {
                    width: '100%',
                    flex: '0 0 auto',
                    height: chartIframeMin,
                    minHeight: chartIframeMin,
                    maxHeight: chartIframeMin,
                    position: 'relative',
                    borderRadius: '0 0 12px 12px',
                    overflow: 'hidden'
                  }
            }
          >
            <TradeChart
              symbol={symbol}
              minHeight={chartIframeMin}
              fillParent={fullscreenChart}
              active={tradeRouteActive}
            />
          </div>
        </Card>
        {isNarrow && !fullscreenChart && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              alignItems: 'stretch'
            }}
          >
            <Card
              style={{
                padding: '12px 12px',
                minHeight: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid rgba(240, 185, 11, 0.22)`,
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
              }}
            >
              <TradeDepthPanel symbol={symbol} compact premium={userIsPaid} pollingEnabled={tradeRouteActive} />
            </Card>
            <Card
              style={{
                padding: '12px 12px',
                minHeight: 0,
                maxHeight: 360,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid rgba(240, 185, 11, 0.22)`,
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
              }}
            >
              <TradeOrderFormFields
                orderType={orderType}
                setOrderType={setOrderType}
                side={side}
                setSide={setSide}
                userData={userData}
                limitPrice={limitPrice}
                setLimitPrice={setLimitPrice}
                amount={amount}
                setAmount={setAmount}
                leverage={leverage}
                setLeverage={setLeverage}
                tp={tp}
                setTp={setTp}
                sl={sl}
                setSl={setSl}
                msg={msg}
                currentPrice={currentPrice}
                user={user}
                handleTrade={handleTrade}
                loading={loading || socketTradeBusy}
                symbol={symbol}
                dailyOpensUsed={dailyOpensUsed}
                dailyOpensRemaining={dailyOpensRemaining}
                dailyOpensAtLimit={dailyOpensAtLimit}
                dailyOpensEffectiveLimit={dailyOpensEffectiveLimit}
                userIsPaid={userIsPaid}
              />
            </Card>
          </div>
        )}
        </div>
        {showSidePanel && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: 0,
              alignSelf: 'stretch',
              overflow: 'hidden',
              maxHeight: fullscreenChart ? 'min(100dvh - 72px, 100%)' : 'calc(100dvh - 120px)'
            }}
          >
            {!fullscreenChart && (
              <Card
                style={{
                  padding: '12px 16px',
                  flex: '0 1 42%',
                  minHeight: 140,
                  maxHeight: '40vh',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  border: `1px solid rgba(240, 185, 11, 0.22)`,
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                }}
              >
                <TradeDepthPanel symbol={symbol} compact premium={userIsPaid} pollingEnabled={tradeRouteActive} />
              </Card>
            )}
            <div
              style={{
                backgroundColor: T.card,
                borderRadius: 12,
                padding: 20,
                border: `1px solid rgba(240, 185, 11, 0.22)`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                overflowY: 'auto',
                flex: 1,
                minHeight: 0,
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain'
              }}
            >
            <div
              style={{
                paddingBottom: 14,
                marginBottom: 14,
                borderBottom: `1px solid ${T.border}`
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: 3,
                  color: T.yellow,
                  fontWeight: 800
                }}
              >
                AURONX
              </div>
              <div style={{ fontSize: 13, color: T.text, marginTop: 6, fontWeight: 600 }}>
                Pro order ticket
              </div>
            </div>
            <TradeOrderFormFields
              orderType={orderType}
              setOrderType={setOrderType}
              side={side}
              setSide={setSide}
              userData={userData}
              limitPrice={limitPrice}
              setLimitPrice={setLimitPrice}
              amount={amount}
              setAmount={setAmount}
              leverage={leverage}
              setLeverage={setLeverage}
              tp={tp}
              setTp={setTp}
              sl={sl}
              setSl={setSl}
              msg={msg}
              currentPrice={currentPrice}
              user={user}
              handleTrade={handleTrade}
              loading={loading || socketTradeBusy}
              symbol={symbol}
              dailyOpensUsed={dailyOpensUsed}
              dailyOpensRemaining={dailyOpensRemaining}
              dailyOpensAtLimit={dailyOpensAtLimit}
              dailyOpensEffectiveLimit={dailyOpensEffectiveLimit}
              userIsPaid={userIsPaid}
            />
            </div>
          </div>
        )}

        {fullscreenChart && (
          <>
            <button
              type="button"
              className="trade-fab"
              onClick={() => {
                if (fullscreenChart) {
                  setOrderSheetOpen(true);
                  return;
                }
                setOrderSheetOpen(true);
              }}
              aria-label={fullscreenChart ? 'Open order panel' : 'Open order ticket'}
            >
              <span style={{ fontWeight: 800 }}>⚡</span> {fullscreenChart ? 'Order Book' : 'Order'} ·{' '}
              <span style={{ fontWeight: 700 }}>{symbol.replace('USDT', '')}</span>
            </button>
            {orderSheetOpen && (
              <>
                <div
                  className="trade-sheet-backdrop"
                  role="presentation"
                  onClick={() => setOrderSheetOpen(false)}
                />
                <div className="trade-sheet" role="dialog" aria-modal="true" aria-label="Order ticket">
                  <button
                    type="button"
                    className="trade-sheet-handle"
                    onClick={() => setOrderSheetOpen(false)}
                    aria-label="Close order ticket"
                  />
                  <div className="trade-sheet-body">
                    {fullscreenChart ? (
                      <Card
                        style={{
                          padding: '10px 12px',
                          marginBottom: 14,
                          maxHeight: '32vh',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          border: `1px solid ${T.border}`
                        }}
                      >
                        <TradeDepthPanel symbol={symbol} compact premium={userIsPaid} pollingEnabled={tradeRouteActive} />
                      </Card>
                    ) : null}
                    <div
                      style={{
                        paddingBottom: 14,
                        marginBottom: 14,
                        borderBottom: `1px solid ${T.border}`
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          letterSpacing: 3,
                          color: T.yellow,
                          fontWeight: 800
                        }}
                      >
                        AURONX
                      </div>
                      <div style={{ fontSize: 13, color: T.text, marginTop: 6, fontWeight: 600 }}>
                        {fullscreenChart ? 'Order book + order ticket' : 'Pro order ticket'} ·{' '}
                        {symbol.replace('USDT', '')}/USDT
                      </div>
                    </div>
                    <TradeOrderFormFields
                      orderType={orderType}
                      setOrderType={setOrderType}
                      side={side}
                      setSide={setSide}
                      userData={userData}
                      limitPrice={limitPrice}
                      setLimitPrice={setLimitPrice}
                      amount={amount}
                      setAmount={setAmount}
                      leverage={leverage}
                      setLeverage={setLeverage}
                      tp={tp}
                      setTp={setTp}
                      sl={sl}
                      setSl={setSl}
                      msg={msg}
                      currentPrice={currentPrice}
                      user={user}
                      handleTrade={handleTrade}
                      loading={loading || socketTradeBusy}
                      symbol={symbol}
                      dailyOpensUsed={dailyOpensUsed}
                      dailyOpensRemaining={dailyOpensRemaining}
                      dailyOpensAtLimit={dailyOpensAtLimit}
                      dailyOpensEffectiveLimit={dailyOpensEffectiveLimit}
                      userIsPaid={userIsPaid}
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function TradeScreen() {
  return <TradeScreenInner />;
}
