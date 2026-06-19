import React, { useState, useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { AuthContext } from '../authContext';
import { db } from '../firebaseClient';
import { activateBffQuotaFallback, isBffDataMode, isSupabaseFallbackEnabled } from '../config/dataBackend';
import { bff } from '../api/serverBff';
import { shouldFallbackFromFirestoreToSupabase } from '../utils/firestoreQuota';
import { useAllPricesThrottled } from '../hooks/useAllPricesThrottled';
import { T } from '../app/theme';
import { Input } from '../components/ui/AppPrimitives';
import {
  TRADING_PAIRS_USDT,
  TRADING_PAIRS_SET,
  MARKETS_EXCLUDED_PAIRS,
  MARKETS_DEFAULT_LIMIT,
  MARKETS_SEARCH_LIMIT
} from '../config/tradingPairs';
const ROW_DIVIDER = '1px solid rgba(42,46,57,0.32)';

function MarketsScreen() {
  const resolvePct = (d) => {
    const direct = Number(d?.change);
    if (Number.isFinite(direct)) return direct;
    const close = Number(d?.close ?? d?.price);
    const open = Number(d?.open);
    if (Number.isFinite(close) && Number.isFinite(open) && open > 0) {
      return ((close - open) / open) * 100;
    }
    return 0;
  };

  const prices = useAllPricesThrottled(1500);
  const { user, userData, refreshUser } = useContext(AuthContext);
  const [search, setSearch] = useState('');
  const [isWebWide, setIsWebWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1100px)').matches
  );
  const [compactRows, setCompactRows] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
  );
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1100px)');
    const fn = () => setIsWebWide(mq.matches);
    mq.addEventListener('change', fn);
    fn();
    return () => mq.removeEventListener('change', fn);
  }, []);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const fn = () => setCompactRows(mq.matches);
    mq.addEventListener('change', fn);
    fn();
    return () => mq.removeEventListener('change', fn);
  }, []);
  const q = search.trim().toUpperCase();
  const featuredRank = (sym) => {
    const i = TRADING_PAIRS_USDT.indexOf(sym);
    return i >= 0 ? i : 9999;
  };
  const coins = useMemo(() => {
    return Object.entries(prices)
      .filter(([sym]) => {
        if (MARKETS_EXCLUDED_PAIRS.has(sym)) return false;
        if (q) return sym.includes(q);
        return TRADING_PAIRS_SET.has(sym);
      })
      .sort((a, b) => {
        const ra = featuredRank(a[0]);
        const rb = featuredRank(b[0]);
        if (ra !== rb) return ra - rb;
        const va = Number(a[1]?.quoteVolume) || 0;
        const vb = Number(b[1]?.quoteVolume) || 0;
        if (vb !== va) return vb - va;
        return parseFloat(b[1].price) - parseFloat(a[1].price);
      })
      .slice(0, q ? MARKETS_SEARCH_LIMIT : MARKETS_DEFAULT_LIMIT);
  }, [prices, q]);

  const toggleWatchlist = async (symbol) => {
    if (!user) return;
    const isInWatchlist = userData?.watchlist?.includes(symbol);
    const base = Array.isArray(userData?.watchlist) ? [...userData.watchlist] : [];
    const nextList = isInWatchlist ? base.filter((s) => s !== symbol) : [...base, symbol];
    try {
      if (isBffDataMode()) {
        await bff('/api/data/me', {
          method: 'PATCH',
          body: JSON.stringify({ watchlist: nextList })
        });
      } else {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            watchlist: isInWatchlist ? arrayRemove(symbol) : arrayUnion(symbol)
          });
        } catch (e) {
          if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) {
            activateBffQuotaFallback();
            await bff('/api/data/me', {
              method: 'PATCH',
              body: JSON.stringify({ watchlist: nextList })
            });
          } else throw e;
        }
      }
      await refreshUser();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ padding: '16px clamp(12px, 4vw, 26px)', maxWidth: 1340, margin: '0 auto', width: '100%' }}>
      <h2 style={{ color: T.white, marginBottom: 6, fontSize: 24, fontWeight: 800 }}>Markets</h2>
      <p style={{ color: T.text, fontSize: 13, marginBottom: 12, lineHeight: 1.45 }}>
        {TRADING_PAIRS_USDT.length} live USDT pairs · search se aur bhi pairs (Binance)
      </p>
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <span
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 15,
            opacity: 0.55,
            pointerEvents: 'none'
          }}
          aria-hidden
        >
          🔍
        </span>
        <Input
          placeholder="Search e.g. BTC, ETH..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            maxWidth: '100%',
            marginBottom: 0,
            paddingLeft: 42,
            borderRadius: 12,
            background: '#1a1a1a',
            border: `1px solid ${T.border}`
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['All', 'Crypto'].map((tab, i) => (
          <button
            key={tab}
            type="button"
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: i === 0 ? `1px solid ${T.yellow}` : `1px solid ${T.border}`,
              background: i === 0 ? 'rgba(240,185,11,0.12)' : T.card,
              color: i === 0 ? T.yellow : T.text,
              fontWeight: 700,
              fontSize: 12
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <div
        style={{
          borderRadius: 14,
          border: `1px solid ${T.border}`,
          overflowX: compactRows ? 'visible' : 'auto',
          overflowY: 'visible',
          background: '#0a0a0a'
        }}
      >
        {coins.length === 0 ? (
          <div style={{ color: T.text, padding: 40, textAlign: 'center' }}>Loading prices...</div>
        ) : (
          coins.flatMap(([sym, d], i) => {
            const chg = resolvePct(d);
            const isWatched = userData?.watchlist?.includes(sym);
            const priceNum = parseFloat(d.price);
            const priceColor =
              chg > 0.0001 ? T.green : chg < -0.0001 ? T.red : T.white;
            const tradeBtn = (
              <Link
                to={`/trade?symbol=${sym}`}
                style={{
                  color: '#000',
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  background: T.yellow,
                  padding: '8px 14px',
                  borderRadius: 8,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  display: 'inline-block',
                  flexShrink: 0
                }}
              >
                Trade
              </Link>
            );
            const row = compactRows ? (
              <div
                key={sym}
                style={{
                  padding: '12px 12px',
                  borderBottom: ROW_DIVIDER,
                  background: '#0a0a0a'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: T.white, fontWeight: 700, fontSize: 15 }}>
                      {sym.replace('USDT', '')}
                      <span style={{ color: T.text, fontWeight: 500 }}>/USDT</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ color: priceColor, fontWeight: 700, fontSize: 16 }}>
                        ${Number.isFinite(priceNum) ? priceNum.toLocaleString() : '—'}
                      </span>
                      <span
                        style={{
                          color: chg >= 0 ? T.green : T.red,
                          fontWeight: 700,
                          fontSize: 13
                        }}
                      >
                        {chg >= 0 ? '+' : ''}
                        {Number.isFinite(chg) ? chg.toFixed(2) : '0.00'}%
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                    <button
                      type="button"
                      onClick={() => toggleWatchlist(sym)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: isWatched ? T.yellow : T.text,
                        cursor: 'pointer',
                        fontSize: 20,
                        padding: 0,
                        lineHeight: 1
                      }}
                    >
                      {isWatched ? '★' : '☆'}
                    </button>
                    {tradeBtn}
                  </div>
                </div>
              </div>
            ) : (
              <div
                key={sym}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isWebWide
                    ? 'minmax(220px, 2fr) minmax(180px, 1.6fr) minmax(130px, 1fr) auto auto'
                    : 'minmax(140px, 1.5fr) minmax(100px, 1.2fr) minmax(88px, 1fr) auto auto',
                  gap: 8,
                  padding: '13px 12px',
                  borderBottom: ROW_DIVIDER,
                  alignItems: 'center',
                  background: '#0a0a0a',
                  minWidth: 0
                }}
              >
                <span style={{ color: T.white, fontWeight: 700 }}>
                  {sym.replace('USDT', '')}
                  <span style={{ color: T.text, fontWeight: 500 }}>/USDT</span>
                </span>
                <span style={{ color: priceColor, fontWeight: 700 }}>
                  ${Number.isFinite(priceNum) ? priceNum.toLocaleString() : '—'}
                </span>
                <span
                  style={{
                    color: chg >= 0 ? T.green : T.red,
                    fontWeight: 700,
                    borderRadius: 999,
                    fontSize: 12,
                    display: 'inline-block',
                    width: 'fit-content'
                  }}
                >
                  {chg >= 0 ? '+' : ''}
                  {Number.isFinite(chg) ? chg.toFixed(2) : '0.00'}%
                </span>
                {tradeBtn}
                <button
                  type="button"
                  onClick={() => toggleWatchlist(sym)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isWatched ? T.yellow : T.text,
                    cursor: 'pointer',
                    fontSize: 18,
                    padding: 0
                  }}
                >
                  {isWatched ? '★' : '☆'}
                </button>
              </div>
            );
            return [row];
          })
        )}
      </div>
    </div>
  );
};


export default MarketsScreen;
