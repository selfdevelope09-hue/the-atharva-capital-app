import React, { useState, useRef, useEffect, useMemo, useContext, lazy, Suspense } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, runTransaction, increment } from 'firebase/firestore';
import { AuthContext } from '../authContext';
import { db } from '../firebaseClient';
import { coerceJsonArray, normalizeUserDocData } from '../utils/userDoc';
import { ensureFirestoreUserDoc } from '../utils/ensureFirestoreUser';
import {
  activateBffQuotaFallback,
  isBffDataMode,
  isBffTradeMode,
  isFirestoreDisabled,
  isSupabaseFallbackEnabled
} from '../config/dataBackend';
import { isRealtimeTradeMode } from '../config/tradeBackend';
import { bffTrade } from '../api/serverBff';
import { useTradeSocket } from '../hooks/useTradeSocket';
import { shouldFallbackFromFirestoreToSupabase } from '../utils/firestoreQuota';
import { useMergedLivePrices } from '../hooks/useMergedLivePrices';
import { T } from '../app/theme';
import { Card } from '../components/ui/AppPrimitives';
import {
  grossPnlUsdt,
  pnlPctLev,
  roePct,
  liquidationPrice as liqPriceEngine,
  quantityFromNotional,
  enginePositionStatus
} from '../tradingEngine';
import {
  genPositionId,
  findFirestorePositionIndex,
  dedupeClosedPositionsList,
  nextLifetimeRealizedPnl,
  positionDedupeKey
} from '../utils/positionUtils';
import { lookupLivePrice, normalizeBinanceSymbol, parseLiveMarkPrice } from '../utils/marketSymbol';
import { withTradeAsBody } from '../utils/chatAsUid';
import PositionTpSlModal from '../components/PositionTpSlModal';
import { tpSlTriggerReason, formatTpSlLabel } from '../utils/tpSl';

const ClosedPnlLineChart = lazy(() => import('../components/ClosedPnlLineChart'));

/** Showcase / legacy rows sometimes omit numeric fields → raw .toFixed throws and trips the error boundary. */
function n(v, fallback = NaN) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const x = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(x) ? x : fallback;
}

function fmt2(v) {
  const x = n(v);
  return Number.isFinite(x) ? x.toFixed(2) : '—';
}

function fmtSignedUsd(v, { tiny } = {}) {
  const x = n(v);
  if (!Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  if (tiny && a > 0 && a < 0.01) return `${x >= 0 ? '+' : ''}$${x.toFixed(4)}`;
  return `${x >= 0 ? '+' : ''}$${x.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function fmtClosedWhen(v) {
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString();
}

function openPositionChart(navigate, pos) {
  const sym = normalizeBinanceSymbol(pos.symbol);
  navigate(`/trade?symbol=${encodeURIComponent(sym)}&focus=chart`);
}

function DashboardScreen() {
  const [bffModeRev, setBffModeRev] = useState(0);
  const { user, userData, refreshUser, setActingAsUid, actingAsUid, clearActingAsUid, isActingAsShowcase } =
    useContext(AuthContext);
  const useServerUser = isBffDataMode() || isRealtimeTradeMode();
  const walletUid = user?.uid;
  const { closeTrade: socketCloseTrade } = useTradeSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [closeMsg, setCloseMsg] = useState(null);
  const [liveUser, setLiveUser] = useState(null);
  const [closeBusy, setCloseBusy] = useState(false);
  const [editPos, setEditPos] = useState(null);
  const [editIdx, setEditIdx] = useState(-1);
  const closeBusyRef = useRef(false);
  const liqAttemptedRef = useRef(new Set());
  const tpSlAttemptedRef = useRef(new Set());
  const handleCloseRef = useRef(async () => {});

  useEffect(() => {
    const nextUid = new URLSearchParams(location.search).get('actAs');
    if (!nextUid) return;
    setActingAsUid(nextUid);
    navigate('/dashboard', { replace: true });
  }, [location.search, navigate, setActingAsUid]);

  useEffect(() => {
    const fn = () => setBffModeRev((x) => x + 1);
    window.addEventListener('auron-bff-mode', fn);
    return () => window.removeEventListener('auron-bff-mode', fn);
  }, []);

  useEffect(() => {
    if (!walletUid) {
      setLiveUser(null);
      return undefined;
    }
    if (useServerUser) {
      const sync = () => {
        if (userData) setLiveUser(userData);
        else refreshUser?.().catch(() => {});
      };
      sync();
      return undefined;
    }
    ensureFirestoreUserDoc(walletUid).catch(() => {});
    const unsub = onSnapshot(
      doc(db, 'users', walletUid),
      async (snap) => {
        if (snap.exists()) {
          setLiveUser(normalizeUserDocData(snap.data()));
          return;
        }
        try {
          const data = await ensureFirestoreUserDoc(walletUid);
          if (data) setLiveUser(data);
        } catch {
          setLiveUser(null);
        }
      },
      (e) => {
        if (shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) activateBffQuotaFallback();
      }
    );
    return unsub;
  }, [walletUid, bffModeRev, useServerUser, userData, refreshUser]);

  const account = useMemo(() => {
    if (useServerUser && userData) return userData;
    return liveUser || userData;
  }, [useServerUser, userData, liveUser]);

  const positions = useMemo(
    () => (Array.isArray(account?.positions) ? account.positions : []),
    [account?.positions]
  );

  const positionSymbols = useMemo(
    () => positions.map((p) => normalizeBinanceSymbol(p.symbol)),
    [positions]
  );

  const prices = useMergedLivePrices(positionSymbols);

  const { enriched, totalUnrealizedPnL, totalEquityLocked, liveMarkReady } = useMemo(() => {
    let totalGrossUnreal = 0;
    let totalEquityLocked = 0;
    const list = positions.map((pos) => {
      const sym = normalizeBinanceSymbol(pos.symbol);
      const rawMark = parseLiveMarkPrice(lookupLivePrice(prices, sym));
      const entry = parseFloat(pos.entryPrice);
      const hasLive =
        Number.isFinite(rawMark) && rawMark > 0 && Number.isFinite(entry) && entry > 0;
      const cp = hasLive ? rawMark : entry;
      const lev = parseFloat(pos.leverage) || 1;
      const margin = parseFloat(pos.margin) || 0;
      const totalSize = parseFloat(pos.totalSize) || 0;
      const qty =
        Number.isFinite(parseFloat(pos.quantity)) && parseFloat(pos.quantity) > 0
          ? parseFloat(pos.quantity)
          : quantityFromNotional(totalSize, entry);
      const gross = grossPnlUsdt(pos.type, entry, cp, qty);
      const pnlPct = pnlPctLev(pos.type, entry, cp, lev);
      const roe = roePct(gross, margin);
      const liq = liqPriceEngine(pos.type, entry, lev);
      const engineStatus = enginePositionStatus(pos.type, cp, liq, gross, margin);
      if (Number.isFinite(gross)) totalGrossUnreal += gross;
      if (Number.isFinite(margin) && Number.isFinite(gross)) totalEquityLocked += margin + gross;
      return {
        ...pos,
        symbol: sym,
        currentPrice: cp,
        quantity: qty,
        pnl: gross,
        pnlPct,
        roe,
        liquidationPrice: liq,
        engineStatus,
        hasLiveMark: hasLive
      };
    });
    const allLive =
      positions.length === 0 || list.every((row) => row.hasLiveMark);
    return {
      enriched: list,
      totalUnrealizedPnL: totalGrossUnreal,
      totalEquityLocked,
      liveMarkReady: allLive
    };
  }, [positions, prices]);

  const virtualBal = parseFloat(account?.virtualBalance ?? 0);
  const totalEquityLive = virtualBal + totalEquityLocked;

  const formatUnreal = (v) => {
    if (!Number.isFinite(v)) return '$0.00';
    const a = Math.abs(v);
    if (a > 0 && a < 0.01) return `${v >= 0 ? '+' : ''}$${v.toFixed(4)}`;
    return `${v >= 0 ? '+' : ''}$${v.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatClosePnlMsg = (finalPnl, closeReason) => {
    const label =
      closeReason === 'LIQUIDATED'
        ? 'Position liquidated'
        : closeReason === 'TP'
          ? 'Take profit hit'
          : closeReason === 'SL'
            ? 'Stop loss hit'
            : 'Position closed';
    if (!Number.isFinite(finalPnl)) {
      return `${label}. PnL unavailable — refresh and check history.`;
    }
    return `${label}. PnL: ${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)}`;
  };

  const handleClose = async (index, opts = {}) => {
    const pos = enriched[index];
    if (!walletUid || !pos) return;
    const closeReason = ['LIQUIDATED', 'TP', 'SL'].includes(opts.reason) ? opts.reason : 'MANUAL';
    if (closeBusyRef.current) return;
    closeBusyRef.current = true;
    setCloseBusy(true);
    setCloseMsg(null);
    try {
      const closeBody = withTradeAsBody({ enriched: pos, uiIndex: index, closeReason }, actingAsUid, isActingAsShowcase);
      if (isRealtimeTradeMode()) {
        const j = await socketCloseTrade(closeBody);
        const finalPnl = Number(j.finalPnl);
        setCloseMsg({
          t: Number.isFinite(finalPnl) && finalPnl >= 0 ? 'success' : 'error',
          m: formatClosePnlMsg(finalPnl, closeReason)
        });
        return;
      }
      if (isBffTradeMode()) {
        const j = await bffTrade('/api/trade/close', {
          method: 'POST',
          body: JSON.stringify(closeBody)
        });
        await refreshUser();
        window.dispatchEvent(new CustomEvent('auron-leaderboard-reload'));
        window.dispatchEvent(new CustomEvent('auron-firestore-user-sync'));
        const finalPnl = Number(j.finalPnl);
        setCloseMsg({
          t: Number.isFinite(finalPnl) && finalPnl >= 0 ? 'success' : 'error',
          m: formatClosePnlMsg(finalPnl, closeReason)
        });
        return;
      }
      if (isFirestoreDisabled()) {
        throw new Error('Trading backend unavailable. Refresh the page and try again.');
      }
      const userRef = doc(db, 'users', walletUid);
      let closeResult = { finalPnl: 0, openF: 0, closeF: 0 };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          closeResult = await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw new Error('User doc missing');
            const d = userDoc.data() || {};
            const currentPositions = coerceJsonArray(d.positions);
            const matchIdx = findFirestorePositionIndex(currentPositions, pos, index);
            if (matchIdx < 0) {
              throw new Error('Position was not found. Please refresh and try again.');
            }
            const closedRow = currentPositions[matchIdx];
            const entry = parseFloat(closedRow.entryPrice);
            const exitPx = Number.isFinite(parseFloat(String(pos.currentPrice)))
              ? parseFloat(String(pos.currentPrice))
              : entry;
            const qty =
              Number.isFinite(parseFloat(closedRow.quantity)) && parseFloat(closedRow.quantity) > 0
                ? parseFloat(closedRow.quantity)
                : quantityFromNotional(parseFloat(closedRow.totalSize), entry);
            const gross = grossPnlUsdt(closedRow.type, entry, exitPx, qty);
            const storedOpen = Number.isFinite(parseFloat(closedRow.openFee))
              ? Math.max(0, parseFloat(closedRow.openFee))
              : 0;
            const margin = parseFloat(closedRow.margin) || 0;
            const finalPnl =
              closeReason === 'LIQUIDATED' ? -Math.max(0, margin) : gross;
            const balanceCredit =
              closeReason === 'LIQUIDATED' ? margin + finalPnl : margin + finalPnl + storedOpen;
            if (!Number.isFinite(balanceCredit)) {
              throw new Error('Could not calculate close amount. Refresh and retry.');
            }
            const newPositions = currentPositions.filter((_, i) => i !== matchIdx);
            const closedPositions = Array.isArray(d.closedPositions) ? d.closedPositions : [];
            const closedPosition = {
              ...closedRow,
              exitPrice: exitPx,
              grossPnl: gross,
              openFee: 0,
              closeFee: 0,
              realizedPnl: finalPnl,
              closedAt: new Date().toISOString(),
              status: closeReason,
              closeReason,
              closeId: genPositionId()
            };
            const nextClosed = [...closedPositions, closedPosition];
            transaction.update(userRef, {
              virtualBalance: increment(balanceCredit),
              positions: newPositions,
              closedPositions: nextClosed,
              lifetimeRealizedPnl: nextLifetimeRealizedPnl(d.lifetimeRealizedPnl, nextClosed, finalPnl)
            });
            return { finalPnl, openF: 0, closeF: 0 };
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
      await refreshUser();
      const { finalPnl } = closeResult;
      setCloseMsg({
        t: Number.isFinite(finalPnl) && finalPnl >= 0 ? 'success' : 'error',
        m: formatClosePnlMsg(finalPnl, closeReason)
      });
    } catch (e) {
      if (isRealtimeTradeMode() && isBffTradeMode()) {
        try {
          const j = await bffTrade('/api/trade/close', {
            method: 'POST',
            body: JSON.stringify({ enriched: pos, uiIndex: index, closeReason })
          });
          await refreshUser();
          const finalPnl = Number(j.finalPnl);
          setCloseMsg({
            t: Number.isFinite(finalPnl) && finalPnl >= 0 ? 'success' : 'error',
            m: formatClosePnlMsg(finalPnl, closeReason)
          });
          return;
        } catch (e2) {
          setCloseMsg({ t: 'error', m: e2.message || 'Close failed' });
          return;
        }
      }
      if (!isBffTradeMode() && shouldFallbackFromFirestoreToSupabase(e) && isSupabaseFallbackEnabled()) {
        try {
          activateBffQuotaFallback();
          const j = await bffTrade('/api/trade/close', {
            method: 'POST',
            body: JSON.stringify({ enriched: pos, uiIndex: index, closeReason })
          });
          await refreshUser();
          const finalPnl = Number(j.finalPnl);
          setCloseMsg({
            t: Number.isFinite(finalPnl) && finalPnl >= 0 ? 'success' : 'error',
            m: formatClosePnlMsg(finalPnl, closeReason)
          });
        } catch (e2) {
          setCloseMsg({ t: 'error', m: e2.message || 'Close failed' });
        }
      } else {
        setCloseMsg({ t: 'error', m: e.message || 'Close failed' });
      }
    } finally {
      closeBusyRef.current = false;
      setCloseBusy(false);
    }
  };

  handleCloseRef.current = handleClose;

  useEffect(() => {
    const liqAttempted = liqAttemptedRef;
    if (!user?.uid || !enriched.length) return undefined;
    if (String(user.uid).startsWith('showcase__')) return undefined;
    const liq = enriched.find((p) => p.engineStatus === 'LIQUIDATED' && p.hasLiveMark);
    if (!liq) return undefined;
    const k = positionDedupeKey(liq);
    if (liqAttempted.current.has(k)) return undefined;
    const idx = enriched.findIndex(
      (p) => positionDedupeKey(p) === k && p.engineStatus === 'LIQUIDATED'
    );
    if (idx < 0) return undefined;
    liqAttempted.current.add(k);
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      Promise.resolve(handleCloseRef.current(idx, { reason: 'LIQUIDATED' })).catch(() => {
        if (!cancelled) liqAttempted.current.delete(k);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      liqAttempted.current.delete(k);
    };
  }, [enriched, user?.uid]);

  useEffect(() => {
    const attempted = tpSlAttemptedRef;
    if (!user?.uid || !enriched.length) return undefined;
    if (String(user.uid).startsWith('showcase__')) return undefined;
    const hit = enriched.find((p) => p.hasLiveMark && tpSlTriggerReason(p, p.currentPrice));
    if (!hit) return undefined;
    const reason = tpSlTriggerReason(hit, hit.currentPrice);
    const k = `${positionDedupeKey(hit)}|${reason}`;
    if (attempted.current.has(k)) return undefined;
    const idx = enriched.findIndex((p) => positionDedupeKey(p) === positionDedupeKey(hit) && p.hasLiveMark);
    if (idx < 0) return undefined;
    attempted.current.add(k);
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      Promise.resolve(handleCloseRef.current(idx, { reason })).catch(() => {
        if (!cancelled) attempted.current.delete(k);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      attempted.current.delete(k);
    };
  }, [enriched, user?.uid]);

  const mergedClosed = useMemo(() => {
    const raw = Array.isArray(account?.closedPositions) ? account.closedPositions : [];
    return dedupeClosedPositionsList(raw);
  }, [account?.closedPositions]);

  useEffect(() => {
    if (useServerUser && userData) setLiveUser(userData);
  }, [useServerUser, userData]);

  const closedChronological = useMemo(
    () => mergedClosed.slice().sort((a, b) => new Date(a.closedAt || 0) - new Date(b.closedAt || 0)),
    [mergedClosed]
  );

  const equityData = useMemo(() => {
    let cum = 0;
    return closedChronological.map((pos, idx) => {
      const single = Number(pos.realizedPnl) || 0;
      cum += single;
      const sym = String(pos.symbol || '').replace(/USDT/i, '');
      return {
        name: `#${idx + 1} ${sym}`,
        cumRealized: cum,
        tradePnl: single
      };
    });
  }, [closedChronological]);

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto', minHeight: '50vh', background: T.bg }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20
        }}
      >
        <h2 style={{ color: T.white, margin: 0 }}>Dashboard</h2>
        {user && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link
              to={`/profile/${encodeURIComponent(user.uid)}`}
              style={{ color: T.yellow, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
            >
              My profile
            </Link>
            <Link to="/profile/edit" style={{ color: T.text, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              Edit name / photo / bio
            </Link>
          </div>
        )}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 14,
          marginBottom: 24
        }}
      >
        <Card>
          <div style={{ color: T.text, fontSize: 12, marginBottom: 6 }}>Virtual Balance</div>
          <div style={{ color: T.white, fontSize: 24, fontWeight: 800 }}>
            $
            {virtualBal.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </div>
          <div style={{ color: T.text, fontSize: 11, marginTop: 6 }}>Available (wallet)</div>
        </Card>
        <Card>
          <div style={{ color: T.text, fontSize: 12, marginBottom: 6 }}>Unrealized PnL (live)</div>
          <div
            style={{
              color: totalUnrealizedPnL >= 0 ? T.green : T.red,
              fontSize: 22,
              fontWeight: 800
            }}
          >
            {formatUnreal(totalUnrealizedPnL)}
          </div>
          <div style={{ color: T.text, fontSize: 11, marginTop: 6 }}>
            {positions.length === 0
              ? 'No open positions'
              : liveMarkReady
                ? 'Live mark · ~5 updates/sec'
                : 'Waiting for live prices…'}
          </div>
        </Card>
        <Card>
          <div style={{ color: T.text, fontSize: 12, marginBottom: 6 }}>Total equity (live)</div>
          <div style={{ color: T.white, fontSize: 24, fontWeight: 800 }}>
            $
            {totalEquityLive.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </div>
          <div style={{ color: T.text, fontSize: 11, marginTop: 6 }}>Wallet + open position margin &amp; PnL</div>
        </Card>
        <Card>
          <div style={{ color: T.text, fontSize: 12, marginBottom: 6 }}>Open Positions</div>
          <div style={{ color: T.white, fontSize: 24, fontWeight: 800 }}>
            {positions.length}
          </div>
        </Card>
      </div>

      {/* PnL Chart */}
      {equityData.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <h3 style={{ color: T.white, marginTop: 0, marginBottom: 16 }}>Closed PnL History</h3>
          <Suspense
            fallback={
              <div
                style={{
                  height: 220,
                  background: T.card,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`
                }}
              />
            }
          >
            <ClosedPnlLineChart data={equityData} />
          </Suspense>
        </Card>
      )}

      {closeMsg && (
        <div
          style={{
            backgroundColor:
              closeMsg.t === 'success' ? 'rgba(2,192,118,0.15)' : 'rgba(246,70,93,0.15)',
            color: closeMsg.t === 'success' ? T.green : T.red,
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14
          }}
        >
          {closeMsg.m}
        </div>
      )}

      {actingAsUid ? (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${T.yellow}`,
            background: 'rgba(240,185,11,0.1)',
            color: T.text,
            fontSize: 13,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10
          }}
        >
          <span>
            {isActingAsShowcase
              ? `Showcase mode — ${userData?.name || 'trader'} ke account se trade ho rahi hai. Profile photo: Profile → Edit.`
              : 'Developer showcase mode — is profile ke account se trade ho rahi hai.'}
          </span>
          <button
            type="button"
            onClick={clearActingAsUid}
            style={{
              border: `1px solid ${T.yellow}`,
              background: 'transparent',
              color: T.yellow,
              borderRadius: 6,
              padding: '6px 10px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Exit showcase
          </button>
        </div>
      ) : null}
      <h3 style={{ color: T.white, marginBottom: 4 }}>Open Positions</h3>
      <p style={{ color: T.text, fontSize: 12, marginTop: 0, marginBottom: 14, lineHeight: 1.45 }}>
        <strong style={{ color: T.yellow }}>Edit</strong> to set take profit / stop loss (auto-close on hit).{' '}
        <strong style={{ color: T.yellow }}>View</strong> opens the chart on Trade.
      </p>
      {enriched.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ color: T.text, marginBottom: 14 }}>No open positions. Start trading!</div>
          <Link
            to="/trade"
            style={{
              backgroundColor: T.yellow,
              color: '#000',
              padding: '10px 24px',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
          >
            Open a Trade
          </Link>
        </Card>
      ) : (
        enriched.map((pos, i) => (
          <Card
            key={positionDedupeKey(pos) || `${pos.symbol}-${i}`}
            style={{
              marginBottom: 12,
              borderLeft: `3px solid ${pos.type === 'LONG' ? T.green : T.red}`
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    color: pos.type === 'LONG' ? T.green : T.red,
                    fontWeight: 700,
                    fontSize: 16
                  }}
                >
                  {pos.symbol} {pos.type}{' '}
                  {Number.isFinite(n(pos.leverage)) ? `${Math.round(n(pos.leverage))}` : '—'}x
                </span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '8px 20px',
                    marginTop: 12
                  }}
                >
                  {[
                    ['Entry', `$${fmt2(pos.entryPrice)}`],
                    ['Mark', `$${fmt2(pos.currentPrice)}`],
                    ['Size', `$${fmt2(pos.totalSize)}`],
                    ['Margin', `$${fmt2(pos.margin)}`],
                    [
                      'Qty (base)',
                      (() => {
                        const q = n(pos.quantity);
                        if (!Number.isFinite(q)) return '—';
                        return `${q < 1e-4 ? q.toFixed(8) : q.toFixed(5)}`;
                      })()
                    ],
                    [
                      'Liq. price',
                      Number.isFinite(pos.liquidationPrice)
                        ? `$${pos.liquidationPrice.toFixed(2)}`
                        : '—'
                    ],
                    ['PnL', fmtSignedUsd(pos.pnl, { tiny: true })],
                    [
                      'PnL %',
                      Number.isFinite(n(pos.pnlPct))
                        ? `${n(pos.pnlPct) >= 0 ? '+' : ''}${n(pos.pnlPct).toFixed(2)}%`
                        : '—'
                    ],
                    [
                      'ROE',
                      Number.isFinite(n(pos.roe)) ? `${n(pos.roe) >= 0 ? '+' : ''}${n(pos.roe).toFixed(2)}%` : '—'
                    ],
                    ['Status', pos.engineStatus],
                    ['Take profit', formatTpSlLabel(pos.tp)],
                    ['Stop loss', formatTpSlLabel(pos.sl)]
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ color: T.text, fontSize: 11 }}>
                        {l}
                        {l === 'Mark' && !pos.hasLiveMark ? ' · …' : ''}
                      </div>
                      <div
                        style={{
                          color:
                            l === 'PnL'
                              ? n(pos.pnl, 0) >= 0
                                ? T.green
                                : T.red
                              : l === 'ROE' || l === 'PnL %'
                                ? (l === 'ROE' ? n(pos.roe, 0) : n(pos.pnlPct, 0)) >= 0
                                  ? T.green
                                  : T.red
                                : l === 'Status' && pos.engineStatus === 'LIQUIDATED'
                                  ? T.red
                                  : T.white,
                          fontSize: 14,
                          fontWeight: 600
                        }}
                      >
                        {v}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginLeft: 12,
                  flexShrink: 0,
                  alignSelf: 'flex-start'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setEditPos(pos);
                    setEditIdx(i);
                  }}
                  style={{
                    background: 'rgba(56,151,240,0.18)',
                    border: '1px solid rgba(56,151,240,0.45)',
                    color: '#7ec8ff',
                    padding: '8px 14px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    minWidth: 72
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => openPositionChart(navigate, pos)}
                  style={{
                    background: `linear-gradient(135deg, ${T.yellow} 0%, #d8a400 100%)`,
                    border: 'none',
                    color: '#000',
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 800,
                    minWidth: 72
                  }}
                >
                  View
                </button>
                <button
                  type="button"
                  disabled={closeBusy}
                  onClick={() => handleClose(i)}
                  style={{
                    backgroundColor: T.card2,
                    border: `1px solid ${T.border}`,
                    color: T.white,
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: closeBusy ? 'wait' : 'pointer',
                    fontSize: 13,
                    opacity: closeBusy ? 0.55 : 1
                  }}
                >
                  {closeBusy ? '…' : 'Close'}
                </button>
              </div>
            </div>
          </Card>
        ))
      )}

      {/* Closed Positions History */}
      <h3 style={{ color: T.white, marginTop: 32, marginBottom: 12 }}>Order History</h3>
      {mergedClosed.length > 0 ? (
        mergedClosed
          .slice()
          .reverse()
          .map((pos, idx) => (
            <Card
              key={pos.closeId || pos.positionId || `${pos.symbol}-${pos.closedAt}-${idx}`}
              style={{ marginBottom: 8, opacity: 0.9 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10
                }}
              >
                <span>
                  <span
                    style={{
                      color: pos.status === 'LIQUIDATED' ? T.red : pos.type === 'LONG' ? T.green : pos.type === 'ROAST' ? '#f6465d' : T.red,
                      fontWeight: 600
                    }}
                  >
                    {pos.source === 'roast' || pos.type === 'ROAST'
                      ? `ROAST · by Roast`
                      : `${pos.symbol} ${pos.type}${pos.status === 'LIQUIDATED' ? ' • LIQUIDATED' : ''}`}
                  </span>{' '}
                  <span style={{ color: T.text }}>
                    {fmtClosedWhen(pos.closedAt)}
                  </span>
                </span>
                <span
                  style={{
                    color: n(pos.realizedPnl, 0) >= 0 ? T.green : T.red,
                    fontWeight: 600
                  }}
                >
                  {fmtSignedUsd(pos.realizedPnl)}
                </span>
              </div>
              <div style={{ color: T.text, fontSize: 12, marginTop: 4 }}>
                Entry ${fmt2(pos.entryPrice)} → Exit ${fmt2(n(pos.exitPrice, pos.entryPrice))} | Size $
                {fmt2(pos.totalSize)} | Leverage {n(pos.leverage, 1)}x
              </div>
            </Card>
          ))
      ) : (
        <Card style={{ textAlign: 'center', padding: 30, color: T.text }}>
          No closed trades yet.
        </Card>
      )}

      <PositionTpSlModal
        open={editPos != null}
        position={editPos}
        uiIndex={editIdx}
        walletUid={walletUid}
        actingAsUid={actingAsUid}
        isActingAsShowcase={isActingAsShowcase}
        onClose={() => {
          setEditPos(null);
          setEditIdx(-1);
        }}
        onSaved={() => {
          refreshUser?.().catch(() => {});
          window.dispatchEvent(new CustomEvent('auron-firestore-user-sync'));
        }}
      />
    </div>
  );
};

export default DashboardScreen;
