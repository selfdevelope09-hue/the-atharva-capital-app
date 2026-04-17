import React, { useState, createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut
} from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, increment,
  arrayUnion, arrayRemove, collection, query, orderBy, limit, getDocs, runTransaction
} from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const firebaseConfig = {
  apiKey: "AIzaSyB4bz_8fGhrCqyyV-N_pA7s7dzVMKIPn_w",
  authDomain: "theatharvacapital-trading.firebaseapp.com",
  projectId: "theatharvacapital-trading",
  storageBucket: "theatharvacapital-trading.firebasestorage.app",
  messagingSenderId: "644668465681",
  appId: "1:644668465681:web:664ff835f83c55765007b0"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const T = {
  bg: '#0b0e11', card: '#161a1e', card2: '#1e2329', card3: '#252b33',
  yellow: '#f0b90b', yellowDim: 'rgba(240,185,11,0.12)',
  green: '#0ecb81', greenDim: 'rgba(14,203,129,0.12)',
  red: '#f6465d', redDim: 'rgba(246,70,93,0.12)',
  text: '#7b8390', text2: '#a8b0bc', white: '#eaecef',
  border: '#2b2f36', border2: '#1e2329',
  tpLine: '#0ecb81', slLine: '#f6465d', entryLine: '#f0b90b'
};

const FEES = { maker: 0.0002, taker: 0.0005 };

const AuthContext = createContext();
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (uid) => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = { positions: [], closedPositions: [], watchlist: [], ...snap.data() };
      setUserData(data); return data;
    }
    return null;
  };

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await fetchUserData(u.uid);
      else setUserData(null);
      setLoading(false);
    });
  }, []);

  const signUp = async (email, password, name) => {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    const data = { uid: res.user.uid, email, name: name || 'Trader', virtualBalance: 10000, positions: [], closedPositions: [], watchlist: [], createdAt: new Date().toISOString() };
    await setDoc(doc(db, 'users', res.user.uid), data);
    setUserData(data);
  };

  const login = (e, p) => signInWithEmailAndPassword(auth, e, p);
  const logout = () => signOut(auth);
  const refreshUser = async () => { if (user) return fetchUserData(user.uid); };

  return <AuthContext.Provider value={{ user, userData, loading, signUp, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
};

const PriceContext = createContext({});
const PriceProvider = ({ children }) => {
  const [prices, setPrices] = useState({});
  useEffect(() => {
    let ws;
    const connect = () => {
      ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');
      ws.onmessage = (e) => {
        const arr = JSON.parse(e.data);
        const upd = {};
        arr.forEach(c => {
          if (c.s.endsWith('USDT')) {
            upd[c.s] = { price: parseFloat(c.c).toFixed(2), close: parseFloat(c.c), open: parseFloat(c.o), high: parseFloat(c.h), low: parseFloat(c.l), vol: parseFloat(c.v), change: (((parseFloat(c.c) - parseFloat(c.o)) / parseFloat(c.o)) * 100).toFixed(2) };
          }
        });
        setPrices(prev => ({ ...prev, ...upd }));
      };
      ws.onclose = () => setTimeout(connect, 3000);
    };
    connect();
    return () => ws?.close();
  }, []);
  return <PriceContext.Provider value={prices}>{children}</PriceContext.Provider>;
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div style={{ color: T.yellow, textAlign: 'center', marginTop: 80, fontSize: 16 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

const Inp = ({ style, ...p }) => (
  <input style={{ background: T.card3, border: `1px solid ${T.border}`, color: T.white, padding: '9px 11px', borderRadius: 5, width: '100%', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', ...style }} {...p} />
);

const Btn = ({ children, style, bg, tc, ...p }) => (
  <button style={{ background: bg || T.yellow, color: tc || '#000', border: 'none', padding: '11px 16px', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer', width: '100%', opacity: p.disabled ? 0.55 : 1, fontFamily: 'inherit', ...style }} {...p}>{children}</button>
);

const Card = ({ children, style }) => <div style={{ background: T.card2, borderRadius: 10, ...style }}>{children}</div>;
const fmt = (n, d = 2) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const Navbar = () => {
  const { user, userData, logout } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const links = [['/', 'Home'], ['/markets', 'Markets'], ['/trade', 'Trade'], ['/dashboard', 'Dashboard'], ['/wallet', 'Wallet'], ['/leaderboard', 'Leaderboard']];
  return (
    <>
      <style>{`
        @media(max-width:720px){.dnav{display:none!important}.mnav{display:flex!important}}
        @media(min-width:721px){.mnav{display:none!important}}
        input[type=range]{accent-color:${T.yellow}}
        *{scrollbar-width:thin;scrollbar-color:${T.border} transparent}
        *::-webkit-scrollbar{width:3px;height:3px}
        *::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px}
      `}</style>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px', height: 50, background: T.card, borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 500 }}>
        <Link to="/" style={{ color: T.yellow, fontWeight: 900, textDecoration: 'none', fontSize: 15, letterSpacing: 0.5 }}>⚡ ATHARVA CAPITAL</Link>
        <div className="dnav" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {links.map(([p, l]) => <Link key={p} to={p} style={{ color: T.text2, textDecoration: 'none', fontSize: 13 }}>{l}</Link>)}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: T.yellow, fontSize: 12, fontWeight: 700, background: T.yellowDim, padding: '4px 10px', borderRadius: 4 }}>${fmt(userData?.virtualBalance)}</span>
              <button onClick={logout} style={{ background: 'none', border: `1px solid ${T.red}`, color: T.red, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Out</button>
            </div>
          ) : <Link to="/login" style={{ background: T.yellow, color: '#000', padding: '5px 14px', borderRadius: 4, textDecoration: 'none', fontWeight: 700, fontSize: 12 }}>Login</Link>}
        </div>
        <div className="mnav" style={{ display: 'none', alignItems: 'center', gap: 8 }}>
          {user && <span style={{ color: T.yellow, fontSize: 11, fontWeight: 700 }}>${fmt(userData?.virtualBalance, 0)}</span>}
          <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', color: T.white, fontSize: 20, cursor: 'pointer' }}>☰</button>
        </div>
        {open && (
          <div style={{ position: 'fixed', top: 50, right: 0, background: T.card, border: `1px solid ${T.border}`, borderRadius: '0 0 10px 10px', zIndex: 600, minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            {links.map(([p, l]) => <Link key={p} to={p} onClick={() => setOpen(false)} style={{ display: 'block', color: T.text2, textDecoration: 'none', padding: '11px 20px', fontSize: 14, borderBottom: `1px solid ${T.border2}` }}>{l}</Link>)}
            {user ? <button onClick={() => { logout(); setOpen(false); }} style={{ width: '100%', background: 'none', border: 'none', color: T.red, padding: '11px 20px', textAlign: 'left', cursor: 'pointer', fontSize: 14 }}>Logout</button>
              : <Link to="/login" onClick={() => setOpen(false)} style={{ display: 'block', color: T.yellow, padding: '11px 20px', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>Login</Link>}
          </div>
        )}
      </nav>
    </>
  );
};

// Canvas-based TP/SL overlay that floats above TradingView iframe
const ChartWithOverlay = ({ symbol, currentPrice, tp, sl, onTpChange, onSlChange, height = 460 }) => {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const animRef = useRef(null);
  const priceRef = useRef(currentPrice);

  useEffect(() => { priceRef.current = currentPrice; }, [currentPrice]);

  const getRange = useCallback(() => {
    const p = priceRef.current || 1;
    const r = p * 0.08;
    return { minP: p - r, maxP: p + r };
  }, []);

  const priceToY = useCallback((price) => {
    if (!price || !wrapRef.current) return null;
    const { minP, maxP } = getRange();
    const h = wrapRef.current.clientHeight;
    return ((maxP - price) / (maxP - minP)) * h;
  }, [getRange]);

  const yToPrice = useCallback((y) => {
    if (!wrapRef.current) return 0;
    const { minP, maxP } = getRange();
    const h = wrapRef.current.clientHeight;
    return maxP - (y / h) * (maxP - minP);
  }, [getRange]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !priceRef.current) return;
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const cp = priceRef.current;

    function roundRect(x, y, rw, rh, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + rw - r, y);
      ctx.quadraticCurveTo(x + rw, y, x + rw, y + r);
      ctx.lineTo(x + rw, y + rh - r);
      ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh);
      ctx.lineTo(x + r, y + rh);
      ctx.quadraticCurveTo(x, y + rh, x, y + rh - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function drawLine(price, color, label, pctVal, pnlUsd, isDrag) {
      const y = priceToY(price);
      if (y === null || y < 4 || y > h - 4) return;

      // Dashed line with glow
      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = isDrag ? 16 : 7;
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = color; ctx.lineWidth = isDrag ? 2.5 : 1.8;
      ctx.globalAlpha = isDrag ? 1 : 0.88;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;

      // Left pill
      const pl = 78, ph = 20;
      ctx.fillStyle = color;
      roundRect(4, y - ph / 2, pl, ph, 4); ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = '700 10px monospace'; ctx.textBaseline = 'middle';
      ctx.fillText(label, 10, y);

      // Price tag right
      const ps = `$${parseFloat(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: price > 10 ? 2 : 5 })}`;
      ctx.font = '700 10px monospace';
      const ptw = ctx.measureText(ps).width + 14;
      ctx.fillStyle = color;
      roundRect(w - ptw - 4, y - ph / 2, ptw, ph, 4); ctx.fill();
      ctx.fillStyle = '#000'; ctx.fillText(ps, w - ptw + 5, y);

      // PnL badge center
      if (pctVal !== null) {
        const pnlStr = `${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(2)}%   $${Math.abs(pnlUsd).toFixed(2)}`;
        ctx.font = '700 10px monospace';
        const bw = ctx.measureText(pnlStr).width + 18, bh = 24;
        const bx = (w - bw) / 2, by = y - bh / 2;
        ctx.fillStyle = 'rgba(11,14,17,0.9)';
        roundRect(bx, by, bw, bh, 5); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([]);
        roundRect(bx, by, bw, bh, 5); ctx.stroke();
        ctx.fillStyle = color; ctx.fillText(pnlStr, bx + 9, y);
      }

      // Drag handle
      ctx.setLineDash([]);
      ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(w / 2, y, isDrag ? 8 : 6, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    }

    // Entry line (subtle)
    const ey = priceToY(cp);
    if (ey !== null && ey > 0 && ey < h) {
      ctx.save(); ctx.setLineDash([4, 8]); ctx.strokeStyle = T.entryLine;
      ctx.lineWidth = 1; ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.moveTo(0, ey); ctx.lineTo(w, ey); ctx.stroke(); ctx.restore();
      ctx.font = '600 9px monospace'; ctx.fillStyle = T.entryLine; ctx.globalAlpha = 0.6;
      ctx.textBaseline = 'bottom'; ctx.fillText(`ENTRY  $${parseFloat(cp).toLocaleString()}`, 6, ey - 3);
      ctx.globalAlpha = 1;
    }

    const tpVal = tp ? parseFloat(tp) : null;
    const slVal = sl ? parseFloat(sl) : null;

    if (tpVal && tpVal > 0) {
      const pct = ((tpVal - cp) / cp) * 100;
      const usd = Math.abs(pct / 100) * cp;
      drawLine(tpVal, T.tpLine, '🎯 TP', pct, usd, dragRef.current === 'tp');
    }
    if (slVal && slVal > 0) {
      const pct = ((slVal - cp) / cp) * 100;
      const usd = Math.abs(pct / 100) * cp;
      drawLine(slVal, T.slLine, '🛑 SL', pct, usd, dragRef.current === 'sl');
    }

    // R:R badge
    if (tpVal && slVal && tpVal > 0 && slVal > 0) {
      const tpD = Math.abs(tpVal - cp), slD = Math.abs(slVal - cp);
      const rr = slD > 0 ? (tpD / slD).toFixed(2) : '—';
      ctx.font = '700 11px monospace';
      const txt = `R:R = 1:${rr}`;
      const bw = ctx.measureText(txt).width + 16;
      ctx.fillStyle = 'rgba(11,14,17,0.88)';
      roundRect(6, 6, bw, 26, 5); ctx.fill();
      ctx.strokeStyle = T.yellow; ctx.lineWidth = 1; ctx.setLineDash([]);
      roundRect(6, 6, bw, 26, 5); ctx.stroke();
      ctx.fillStyle = T.yellow; ctx.textBaseline = 'middle'; ctx.fillText(txt, 14, 19);
    }
  }, [tp, sl, priceToY]);

  useEffect(() => {
    const loop = () => { draw(); animRef.current = requestAnimationFrame(loop); };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (canvasRef.current && wrapRef.current) {
        canvasRef.current.width = wrapRef.current.clientWidth;
        canvasRef.current.height = wrapRef.current.clientHeight;
      }
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const getHit = (clientY) => {
    if (!wrapRef.current) return null;
    const rect = wrapRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const thr = 16;
    if (tp) { const ty = priceToY(parseFloat(tp)); if (ty !== null && Math.abs(y - ty) < thr) return 'tp'; }
    if (sl) { const sy = priceToY(parseFloat(sl)); if (sy !== null && Math.abs(y - sy) < thr) return 'sl'; }
    return null;
  };

  const onDown = (e) => {
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const t = getHit(cy);
    if (t) { dragRef.current = t; e.preventDefault(); }
  };

  const onMove = useCallback((e) => {
    if (!dragRef.current || !wrapRef.current) return;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = wrapRef.current.getBoundingClientRect();
    const price = yToPrice(cy - rect.top);
    const decimals = price > 10 ? 2 : 5;
    if (dragRef.current === 'tp') onTpChange(price.toFixed(decimals));
    if (dragRef.current === 'sl') onSlChange(price.toFixed(decimals));
    e.preventDefault();
  }, [yToPrice, onTpChange, onSlChange]);

  const onUp = () => { dragRef.current = null; };

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [onMove]);

  const h = typeof height === 'number' ? height : undefined;

  return (
    <div ref={wrapRef} style={{ position: 'relative', height: h || '100%', background: '#131722', flex: h ? undefined : 1 }}>
      <iframe
        key={symbol}
        src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE%3A${symbol}&interval=15&theme=dark&style=1&locale=en&toolbar_bg=%23161a1e&hide_side_toolbar=0&allow_symbol_change=0&save_image=0`}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="TradingView"
      />
      <canvas
        ref={canvasRef}
        onMouseDown={onDown}
        onTouchStart={onDown}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, pointerEvents: (tp || sl) ? 'all' : 'none', cursor: 'crosshair' }}
      />
    </div>
  );
};

const OrderForm = ({ symbol, currentPrice, tp, setTp, sl, setSl }) => {
  const { user, userData, refreshUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [orderType, setOrderType] = useState('Market');
  const [feeType, setFeeType] = useState('taker');
  const [side, setSide] = useState('BUY');
  const [amount, setAmount] = useState('');
  const [amtPct, setAmtPct] = useState(null);
  const [limitPrice, setLimitPrice] = useState('');
  const [leverage, setLeverage] = useState(10);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const execPrice = orderType === 'Market' ? currentPrice : parseFloat(limitPrice || currentPrice);
  const bal = parseFloat(userData?.virtualBalance || 0);
  const amt = parseFloat(amount) || 0;
  const marginReq = leverage > 0 ? amt / leverage : amt;
  const feeRate = feeType === 'maker' ? FEES.maker : FEES.taker;
  const fee = amt * feeRate;
  const totalCost = marginReq + fee;
  const tpVal = tp ? parseFloat(tp) : null;
  const slVal = sl ? parseFloat(sl) : null;
  const tpPct = tpVal && execPrice ? ((tpVal - execPrice) / execPrice * 100) : null;
  const slPct = slVal && execPrice ? ((slVal - execPrice) / execPrice * 100) : null;
  const potProfit = tpPct !== null && amt > 0 ? (Math.abs(tpPct) / 100) * amt * leverage : null;
  const potLoss = slPct !== null && amt > 0 ? (Math.abs(slPct) / 100) * amt * leverage : null;

  const setPct = (pct) => { setAmount(((bal * pct) / 100).toFixed(2)); setAmtPct(pct); };

  const autoTPSL = () => {
    if (!execPrice) return;
    const d = execPrice > 10 ? 2 : 5;
    setTp((execPrice * (side === 'BUY' ? 1.02 : 0.98)).toFixed(d));
    setSl((execPrice * (side === 'BUY' ? 0.98 : 1.02)).toFixed(d));
  };

  const handleTrade = async () => {
    if (!user) return navigate('/login');
    if (!amt || amt <= 0) return setMsg({ t: 'e', m: 'Enter valid amount.' });
    if (totalCost > bal) return setMsg({ t: 'e', m: `Need $${totalCost.toFixed(2)}. Balance: $${bal.toFixed(2)}` });
    setLoading(true);
    try {
      const ref = doc(db, 'users', user.uid);
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('User not found');
        if (totalCost > snap.data().virtualBalance) throw new Error('Insufficient balance');
        tx.update(ref, {
          virtualBalance: increment(-totalCost),
          positions: arrayUnion({ symbol, type: side === 'BUY' ? 'LONG' : 'SHORT', entryPrice: execPrice, leverage, margin: marginReq, totalSize: amt, fee, feeType, tp: tpVal, sl: slVal, status: 'OPEN', time: new Date().toISOString() })
        });
      });
      await refreshUser();
      setMsg({ t: 's', m: `✅ ${side === 'BUY' ? 'LONG' : 'SHORT'} ${symbol.replace('USDT', '')} @ $${execPrice.toFixed(2)}` });
      setAmount(''); setAmtPct(null);
      setTimeout(() => setMsg(null), 3000);
    } catch (e) { setMsg({ t: 'e', m: e.message }); }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Order type + fee type row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
        <div style={{ display: 'flex', background: T.card3, borderRadius: 5, overflow: 'hidden' }}>
          {['Market', 'Limit'].map(t => (
            <button key={t} onClick={() => setOrderType(t)} style={{ flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', background: orderType === t ? T.yellow : 'transparent', color: orderType === t ? '#000' : T.text, fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', background: T.card3, borderRadius: 5, overflow: 'hidden' }}>
          {['maker', 'taker'].map(f => (
            <button key={f} onClick={() => setFeeType(f)} style={{ flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', background: feeType === f ? (f === 'maker' ? T.greenDim : T.yellowDim) : 'transparent', color: feeType === f ? (f === 'maker' ? T.green : T.yellow) : T.text, fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>{f === 'maker' ? 'Maker' : 'Taker'}</button>
          ))}
        </div>
      </div>

      {/* Fee info row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 8 }}>
        {[['Maker', '0.02%', T.green], ['Taker', '0.05%', T.yellow], ['Price', `$${parseFloat(currentPrice || 0).toLocaleString()}`, T.white]].map(([l, v, c]) => (
          <div key={l} style={{ background: T.card3, borderRadius: 5, padding: '5px 7px', textAlign: 'center' }}>
            <div style={{ color: T.text, fontSize: 9, marginBottom: 2 }}>{l}</div>
            <div style={{ color: c, fontWeight: 700, fontSize: 11 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Long / Short */}
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', marginBottom: 10, border: `1px solid ${T.border}` }}>
        <button onClick={() => setSide('BUY')} style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', background: side === 'BUY' ? T.green : 'transparent', color: side === 'BUY' ? '#000' : T.text, fontWeight: 800, fontSize: 13, fontFamily: 'inherit' }}>▲ Long</button>
        <button onClick={() => setSide('SELL')} style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', background: side === 'SELL' ? T.red : 'transparent', color: side === 'SELL' ? '#fff' : T.text, fontWeight: 800, fontSize: 13, fontFamily: 'inherit' }}>▼ Short</button>
      </div>

      {userData && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, fontSize: 11 }}>
          <span style={{ color: T.text }}>Available</span>
          <span style={{ color: T.white, fontWeight: 600 }}>${fmt(bal)} USDT</span>
        </div>
      )}

      {orderType === 'Limit' && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ color: T.text, fontSize: 11, marginBottom: 3 }}>Limit Price</div>
          <Inp type="number" placeholder={execPrice.toFixed(2)} value={limitPrice} onChange={e => setLimitPrice(e.target.value)} />
        </div>
      )}

      {/* Amount */}
      <div style={{ marginBottom: 7 }}>
        <div style={{ color: T.text, fontSize: 11, marginBottom: 3 }}>Amount (USDT)</div>
        <Inp type="number" placeholder="0.00" value={amount} onChange={e => { setAmount(e.target.value); setAmtPct(null); }} />
        <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
          {[25, 50, 75, 100].map(p => (
            <button key={p} onClick={() => setPct(p)} style={{ flex: 1, padding: '4px 0', border: `1px solid ${amtPct === p ? T.yellow : T.border}`, borderRadius: 4, background: amtPct === p ? T.yellowDim : 'transparent', color: amtPct === p ? T.yellow : T.text, fontSize: 10, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>{p}%</button>
          ))}
        </div>
      </div>

      {/* Leverage */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: T.text, fontSize: 11 }}>Leverage</span>
          <span style={{ color: T.yellow, fontSize: 12, fontWeight: 800, background: T.yellowDim, padding: '1px 8px', borderRadius: 3 }}>{leverage}x</span>
        </div>
        <input type="range" min={1} max={125} value={leverage} onChange={e => setLeverage(+e.target.value)} style={{ width: '100%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {[1, 5, 10, 25, 50, 100, 125].map(v => (
            <button key={v} onClick={() => setLeverage(v)} style={{ background: 'none', border: 'none', color: leverage === v ? T.yellow : T.text2, cursor: 'pointer', fontSize: 10, fontWeight: leverage === v ? 800 : 400, fontFamily: 'inherit', padding: '1px 0' }}>{v}x</button>
          ))}
        </div>
      </div>

      {/* TP / SL */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ color: T.text2, fontSize: 11, fontWeight: 700 }}>Take Profit / Stop Loss</span>
          <button onClick={autoTPSL} style={{ background: T.yellowDim, border: `1px solid ${T.yellow}`, color: T.yellow, padding: '2px 8px', borderRadius: 3, fontSize: 10, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>Auto ±2%</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div>
            <div style={{ color: T.green, fontSize: 10, marginBottom: 3, fontWeight: 700 }}>
              🎯 TP {tpPct !== null && <span>({tpPct >= 0 ? '+' : ''}{tpPct.toFixed(2)}%)</span>}
            </div>
            <Inp type="number" placeholder="Price" value={tp} onChange={e => setTp(e.target.value)} style={{ borderColor: tp ? T.green : T.border }} />
            {potProfit !== null && <div style={{ color: T.green, fontSize: 10, marginTop: 2, fontWeight: 700 }}>+${potProfit.toFixed(2)}</div>}
          </div>
          <div>
            <div style={{ color: T.red, fontSize: 10, marginBottom: 3, fontWeight: 700 }}>
              🛑 SL {slPct !== null && <span>({slPct >= 0 ? '+' : ''}{slPct.toFixed(2)}%)</span>}
            </div>
            <Inp type="number" placeholder="Price" value={sl} onChange={e => setSl(e.target.value)} style={{ borderColor: sl ? T.red : T.border }} />
            {potLoss !== null && <div style={{ color: T.red, fontSize: 10, marginTop: 2, fontWeight: 700 }}>-${potLoss.toFixed(2)}</div>}
          </div>
        </div>
        {(tp || sl) && <div style={{ color: T.text, fontSize: 10, marginTop: 4, textAlign: 'center' }}>💡 Drag lines on chart to adjust</div>}
      </div>

      {/* Summary */}
      {amt > 0 && (
        <div style={{ background: T.card3, borderRadius: 6, padding: '9px 11px', marginBottom: 9 }}>
          <div style={{ fontSize: 10, color: T.text, fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Order Summary</div>
          {[
            ['Position Size', `$${fmt(amt)}`],
            ['Margin Required', `$${fmt(marginReq)}`, T.yellow],
            [`Fee (${feeType} ${feeType === 'maker' ? '0.02%' : '0.05%'})`, `-$${fee.toFixed(4)}`, T.red],
            ['Total Cost', `$${fmt(totalCost)}`, T.white],
            potProfit !== null ? ['Est. Profit (TP)', `+$${potProfit.toFixed(2)}`, T.green] : null,
            potLoss !== null ? ['Est. Loss (SL)', `-$${potLoss.toFixed(2)}`, T.red] : null,
          ].filter(Boolean).map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
              <span style={{ color: T.text }}>{l}</span>
              <span style={{ color: c || T.text2, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {msg && <div style={{ background: msg.t === 's' ? T.greenDim : T.redDim, color: msg.t === 's' ? T.green : T.red, padding: '8px 10px', borderRadius: 5, fontSize: 12, marginBottom: 8, border: `1px solid ${msg.t === 's' ? T.green : T.red}` }}>{msg.m}</div>}

      {user
        ? <Btn bg={side === 'BUY' ? T.green : T.red} tc={side === 'BUY' ? '#000' : '#fff'} onClick={handleTrade} disabled={loading}>
            {loading ? 'Placing...' : `${side === 'BUY' ? '▲ Buy / Long' : '▼ Sell / Short'}  ${symbol.replace('USDT', '')}`}
          </Btn>
        : <Link to="/login" style={{ display: 'block', textAlign: 'center', background: T.yellow, color: '#000', padding: 11, borderRadius: 6, fontWeight: 700, textDecoration: 'none', fontSize: 13 }}>Login to Trade</Link>
      }
    </div>
  );
};

const TradeScreen = () => {
  const prices = useContext(PriceContext);
  const params = new URLSearchParams(window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''));
  const [symbol, setSymbol] = useState(params.get('symbol') || 'BTCUSDT');
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn);
  }, []);

  const liveData = prices[symbol] || {};
  const currentPrice = parseFloat(liveData.price || 0);
  const pairs = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'MATICUSDT'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: isMobile ? 'calc(100vh - 50px)' : 'auto' }}>
      {/* Symbol tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '6px 10px', background: T.card, borderBottom: `1px solid ${T.border}`, overflowX: 'auto', flexShrink: 0 }}>
        {pairs.map(s => (
          <button key={s} onClick={() => { setSymbol(s); setTp(''); setSl(''); }} style={{ background: symbol === s ? T.yellow : T.card3, color: symbol === s ? '#000' : T.text2, border: 'none', padding: '5px 11px', borderRadius: 4, cursor: 'pointer', fontWeight: symbol === s ? 800 : 500, fontSize: 12, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{s.replace('USDT', '')}</button>
        ))}
      </div>

      {/* Price bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: T.bg, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ color: T.white, fontWeight: 800, fontSize: 14 }}>{symbol.replace('USDT', '')}/USDT</span>
        <span style={{ color: parseFloat(liveData.change || 0) >= 0 ? T.green : T.red, fontWeight: 800, fontSize: 18 }}>${parseFloat(currentPrice).toLocaleString()}</span>
        <span style={{ color: parseFloat(liveData.change || 0) >= 0 ? T.green : T.red, fontSize: 12, background: parseFloat(liveData.change || 0) >= 0 ? T.greenDim : T.redDim, padding: '2px 7px', borderRadius: 3 }}>{parseFloat(liveData.change || 0) >= 0 ? '+' : ''}{liveData.change || '0.00'}%</span>
        <span style={{ color: T.text, fontSize: 11 }}>H: <b style={{ color: T.text2 }}>${parseFloat(liveData.high || 0).toLocaleString()}</b></span>
        <span style={{ color: T.text, fontSize: 11 }}>L: <b style={{ color: T.text2 }}>${parseFloat(liveData.low || 0).toLocaleString()}</b></span>
        <span style={{ color: T.text, fontSize: 11 }}>Vol: <b style={{ color: T.text2 }}>{liveData.vol ? (liveData.vol / 1e6).toFixed(1) + 'M' : '—'}</b></span>
      </div>

      {isMobile ? (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ChartWithOverlay symbol={symbol} currentPrice={currentPrice} tp={tp} sl={sl} onTpChange={setTp} onSlChange={setSl} height="100%" />

          {!showPanel && (
            <button onClick={() => setShowPanel(true)} style={{ position: 'absolute', bottom: 18, right: 14, zIndex: 50, background: T.green, color: '#000', border: 'none', borderRadius: 28, padding: '13px 22px', fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 24px rgba(14,203,129,0.45)', fontFamily: 'inherit' }}>
              Trade ↗
            </button>
          )}

          {showPanel && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100, background: T.card2, borderRadius: '14px 14px 0 0', border: `1px solid ${T.border}`, boxShadow: '0 -8px 40px rgba(0,0,0,0.7)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 16px 8px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, borderBottom: `1px solid ${T.border}`, position: 'relative' }}>
                <div style={{ width: 36, height: 4, background: T.border, borderRadius: 2 }} />
                <button onClick={() => setShowPanel(false)} style={{ position: 'absolute', right: 14, background: 'none', border: 'none', color: T.text, fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ padding: '12px 14px 28px', overflowY: 'auto', flex: 1 }}>
                <OrderForm symbol={symbol} currentPrice={currentPrice} tp={tp} setTp={setTp} sl={sl} setSl={setSl} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 295px', gap: 8, padding: 10, maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <Card style={{ overflow: 'hidden', padding: 0 }}>
            <ChartWithOverlay symbol={symbol} currentPrice={currentPrice} tp={tp} sl={sl} onTpChange={setTp} onSlChange={setSl} height={500} />
          </Card>
          <Card style={{ padding: 12, overflowY: 'auto', maxHeight: 500 }}>
            <OrderForm symbol={symbol} currentPrice={currentPrice} tp={tp} setTp={setTp} sl={sl} setSl={setSl} />
          </Card>
        </div>
      )}
    </div>
  );
};

const HomeScreen = () => {
  const prices = useContext(PriceContext);
  const { user } = useContext(AuthContext);
  const top = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
  return (
    <div style={{ padding: '32px 14px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ color: T.text, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>Paper Trading Platform</div>
        <h1 style={{ color: T.white, fontSize: 'clamp(24px,7vw,40px)', fontWeight: 900, marginBottom: 10, lineHeight: 1.1 }}>THE ATHARVA <span style={{ color: T.yellow }}>CAPITAL</span></h1>
        <p style={{ color: T.text, fontSize: 15, maxWidth: 440, margin: '0 auto 24px' }}>Trade crypto with $0 risk. Live Binance prices, Exness-style drag TP/SL.</p>
        {!user && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" style={{ background: T.yellow, color: '#000', padding: '11px 28px', borderRadius: 7, fontWeight: 800, textDecoration: 'none', fontSize: 14 }}>Start Free — $10,000</Link>
            <Link to="/markets" style={{ background: T.card2, color: T.white, padding: '11px 28px', borderRadius: 7, fontWeight: 700, textDecoration: 'none', fontSize: 14, border: `1px solid ${T.border}` }}>View Markets</Link>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ color: T.white, fontSize: 15, margin: 0 }}>🔴 Live</h2>
        <Link to="/markets" style={{ color: T.yellow, fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>All Markets →</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 36 }}>
        {top.map(sym => {
          const d = prices[sym]; const chg = d ? parseFloat(d.change) : 0;
          return (
            <Link key={sym} to={`/trade?symbol=${sym}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: T.card2, borderRadius: 8, padding: '12px', borderLeft: `3px solid ${chg >= 0 ? T.green : T.red}` }}>
                <div style={{ color: T.text2, fontWeight: 700, fontSize: 12 }}>{sym.replace('USDT', '')}</div>
                <div style={{ color: T.white, fontSize: 15, fontWeight: 800, margin: '4px 0' }}>${d ? parseFloat(d.price).toLocaleString() : '—'}</div>
                <div style={{ color: chg >= 0 ? T.green : T.red, fontSize: 11, fontWeight: 700 }}>{chg >= 0 ? '+' : ''}{chg}%</div>
              </div>
            </Link>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {[['💰', '$10,000 Virtual', 'Start trading instantly with virtual USDT.'], ['🎯', 'Drag TP/SL Lines', 'Exness-style draggable lines on chart.'], ['💎', 'Maker 0.02% / Taker 0.05%', 'Real exchange fee simulation.'], ['📊', 'Live Binance Data', 'WebSocket real-time prices.'], ['📱', 'Mobile Optimized', 'Full chart + slide-up order panel.'], ['🏆', 'Leaderboard', 'Compete with other traders.']].map(([ic, t, d]) => (
          <div key={t} style={{ background: T.card2, borderRadius: 9, padding: '13px' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{ic}</div>
            <div style={{ color: T.white, fontWeight: 700, marginBottom: 3, fontSize: 12 }}>{t}</div>
            <div style={{ color: T.text, fontSize: 11 }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MarketsScreen = () => {
  const prices = useContext(PriceContext);
  const { user, userData, refreshUser } = useContext(AuthContext);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');

  const coins = Object.entries(prices)
    .filter(([s]) => s.includes(search.toUpperCase()) && (tab === 'all' || userData?.watchlist?.includes(s)))
    .sort((a, b) => parseFloat(b[1].vol || 0) - parseFloat(a[1].vol || 0))
    .slice(0, 80);

  const toggleWatch = async (sym) => {
    if (!user) return;
    const inList = userData?.watchlist?.includes(sym);
    await updateDoc(doc(db, 'users', user.uid), { watchlist: inList ? arrayRemove(sym) : arrayUnion(sym) });
    await refreshUser();
  };

  return (
    <div style={{ padding: 12, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ color: T.white, margin: 0, fontSize: 17 }}>Markets</h2>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: T.card3, borderRadius: 5, overflow: 'hidden' }}>
            {[['all', 'All'], ['watchlist', '★ Watch']].map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} style={{ padding: '6px 11px', border: 'none', cursor: 'pointer', background: tab === v ? T.yellow : 'transparent', color: tab === v ? '#000' : T.text, fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>{l}</button>
            ))}
          </div>
          <Inp placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 130, padding: '6px 10px' }} />
        </div>
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.8fr 1.2fr 1fr 0.5fr', padding: '9px 13px', background: T.card3, borderBottom: `1px solid ${T.border}` }}>
          {['Pair', 'Price', '24h %', 'Action', ''].map(h => <span key={h} style={{ color: T.text, fontSize: 11, fontWeight: 700 }}>{h}</span>)}
        </div>
        {coins.length === 0
          ? <div style={{ color: T.text, padding: 36, textAlign: 'center', fontSize: 13 }}>No results</div>
          : coins.map(([sym, d]) => {
            const chg = parseFloat(d.change);
            const watched = userData?.watchlist?.includes(sym);
            return (
              <div key={sym} style={{ display: 'grid', gridTemplateColumns: '2fr 1.8fr 1.2fr 1fr 0.5fr', padding: '10px 13px', borderBottom: `1px solid ${T.border2}`, alignItems: 'center' }}>
                <span style={{ color: T.white, fontWeight: 700, fontSize: 12 }}>{sym.replace('USDT', '')}<span style={{ color: T.text, fontWeight: 400 }}>/USDT</span></span>
                <span style={{ color: T.white, fontWeight: 600, fontSize: 12 }}>${parseFloat(d.price).toLocaleString()}</span>
                <span style={{ color: chg >= 0 ? T.green : T.red, background: chg >= 0 ? T.greenDim : T.redDim, padding: '2px 6px', borderRadius: 3, fontSize: 11, fontWeight: 700, display: 'inline-block' }}>{chg >= 0 ? '+' : ''}{chg}%</span>
                <Link to={`/trade?symbol=${sym}`} style={{ color: T.yellow, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>Trade →</Link>
                <button onClick={() => toggleWatch(sym)} style={{ background: 'none', border: 'none', color: watched ? T.yellow : T.text, cursor: 'pointer', fontSize: 15 }}>{watched ? '★' : '☆'}</button>
              </div>
            );
          })}
      </Card>
    </div>
  );
};

const DashboardScreen = () => {
  const { user, userData, refreshUser } = useContext(AuthContext);
  const prices = useContext(PriceContext);
  const [closeMsg, setCloseMsg] = useState(null);
  const [tab, setTab] = useState('open');

  const positions = userData?.positions || [];
  let totalPnL = 0;
  const enriched = positions.map(pos => {
    const cp = parseFloat(prices[pos.symbol]?.price || pos.entryPrice);
    const pd = pos.type === 'LONG' ? cp - pos.entryPrice : pos.entryPrice - cp;
    const pnl = (pd / pos.entryPrice) * pos.totalSize;
    const roe = pos.margin > 0 ? (pnl / pos.margin) * 100 : 0;
    totalPnL += pnl;
    return { ...pos, currentPrice: cp, pnl, roe };
  });

  const handleClose = async (index) => {
    const pos = enriched[index];
    const fee = pos.totalSize * FEES.taker;
    const finalPnl = pos.pnl - fee;
    const closed = { ...pos, exitPrice: pos.currentPrice, realizedPnl: finalPnl, closedAt: new Date().toISOString(), status: 'CLOSED' };
    try {
      const ref = doc(db, 'users', user.uid);
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        const np = snap.data().positions.filter((_, i) => i !== index);
        const cp2 = snap.data().closedPositions || [];
        tx.update(ref, { virtualBalance: increment(pos.margin + finalPnl), positions: np, closedPositions: [...cp2, closed] });
      });
      await refreshUser();
      setCloseMsg({ t: finalPnl >= 0 ? 's' : 'e', m: `Closed. PnL: ${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)}` });
      setTimeout(() => setCloseMsg(null), 3000);
    } catch (e) { setCloseMsg({ t: 'e', m: e.message }); }
  };

  const closed = userData?.closedPositions || [];
  const totalRealized = closed.reduce((s, p) => s + (p.realizedPnl || 0), 0);
  const wins = closed.filter(p => p.realizedPnl > 0).length;
  const winRate = closed.length ? ((wins / closed.length) * 100).toFixed(1) : '0';
  const equityData = closed.map((p, i) => ({ name: `#${i + 1}`, cumPnl: parseFloat(closed.slice(0, i + 1).reduce((s, x) => s + x.realizedPnl, 0).toFixed(2)) }));

  return (
    <div style={{ padding: 12, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ color: T.white, marginBottom: 12, fontSize: 17 }}>Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
        {[['Balance', `$${fmt(userData?.virtualBalance)}`, T.yellow], ['Unrealized', `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`, totalPnL >= 0 ? T.green : T.red], ['Realized', `${totalRealized >= 0 ? '+' : ''}$${totalRealized.toFixed(2)}`, totalRealized >= 0 ? T.green : T.red], ['Win Rate', `${winRate}%`, T.green], ['Open', positions.length, T.white], ['Trades', closed.length, T.white]].map(([l, v, c]) => (
          <Card key={l} style={{ padding: 11 }}><div style={{ color: T.text, fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{l}</div><div style={{ color: c, fontSize: 16, fontWeight: 800 }}>{v}</div></Card>
        ))}
      </div>

      {equityData.length > 1 && (
        <Card style={{ marginBottom: 12, padding: 13 }}>
          <div style={{ color: T.white, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Equity Curve</div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={equityData}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.green} stopOpacity={0.3} /><stop offset="95%" stopColor={T.green} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="name" stroke={T.text} tick={{ fontSize: 9 }} />
              <YAxis stroke={T.text} tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ background: T.card, border: 'none', fontSize: 11 }} />
              <Area type="monotone" dataKey="cumPnl" stroke={T.green} fill="url(#g)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {closeMsg && <div style={{ background: closeMsg.t === 's' ? T.greenDim : T.redDim, color: closeMsg.t === 's' ? T.green : T.red, padding: '9px 13px', borderRadius: 6, marginBottom: 10, fontSize: 13, border: `1px solid ${closeMsg.t === 's' ? T.green : T.red}` }}>{closeMsg.m}</div>}

      <div style={{ display: 'flex', background: T.card3, borderRadius: 5, marginBottom: 10, overflow: 'hidden', width: 'fit-content' }}>
        {[['open', `Open (${positions.length})`], ['history', `History (${closed.length})`]].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', background: tab === v ? T.yellow : 'transparent', color: tab === v ? '#000' : T.text, fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>{l}</button>
        ))}
      </div>

      {tab === 'open' && (
        enriched.length === 0
          ? <Card style={{ textAlign: 'center', padding: 32 }}><div style={{ color: T.text, marginBottom: 12, fontSize: 13 }}>No open positions.</div><Link to="/trade" style={{ background: T.yellow, color: '#000', padding: '8px 20px', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>Open Trade</Link></Card>
          : enriched.map((pos, i) => (
            <Card key={i} style={{ marginBottom: 7, borderLeft: `3px solid ${pos.type === 'LONG' ? T.green : T.red}`, padding: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, flexWrap: 'wrap' }}>
                    <span style={{ color: pos.type === 'LONG' ? T.green : T.red, fontWeight: 800, fontSize: 13 }}>{pos.symbol} {pos.type} {pos.leverage}x</span>
                    {pos.tp && <span style={{ background: T.greenDim, color: T.green, fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>TP ${parseFloat(pos.tp).toFixed(2)}</span>}
                    {pos.sl && <span style={{ background: T.redDim, color: T.red, fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>SL ${parseFloat(pos.sl).toFixed(2)}</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))', gap: '4px 12px' }}>
                    {[['Entry', `$${pos.entryPrice.toFixed(2)}`], ['Mark', `$${pos.currentPrice.toFixed(2)}`], ['Size', `$${pos.totalSize.toFixed(2)}`], ['Margin', `$${pos.margin.toFixed(2)}`], ['PnL', `${pos.pnl >= 0 ? '+' : ''}$${pos.pnl.toFixed(2)}`], ['ROE', `${pos.roe >= 0 ? '+' : ''}${pos.roe.toFixed(2)}%`]].map(([l, v]) => (
                      <div key={l}><div style={{ color: T.text, fontSize: 9 }}>{l}</div><div style={{ color: (l === 'PnL' || l === 'ROE') ? (pos.pnl >= 0 ? T.green : T.red) : T.text2, fontSize: 12, fontWeight: 700 }}>{v}</div></div>
                    ))}
                  </div>
                </div>
                <button onClick={() => handleClose(i)} style={{ background: T.card3, border: `1px solid ${T.border}`, color: T.white, padding: '6px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', flexShrink: 0, alignSelf: 'flex-start' }}>Close</button>
              </div>
            </Card>
          ))
      )}

      {tab === 'history' && (
        closed.length === 0
          ? <Card style={{ textAlign: 'center', padding: 28, color: T.text, fontSize: 13 }}>No closed trades yet.</Card>
          : closed.slice().reverse().map((pos, i) => (
            <Card key={i} style={{ marginBottom: 6, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 5 }}>
                <span><span style={{ color: pos.type === 'LONG' ? T.green : T.red, fontWeight: 700, fontSize: 12 }}>{pos.symbol} {pos.type}</span><span style={{ color: T.text, fontSize: 11, marginLeft: 7 }}>{new Date(pos.closedAt).toLocaleDateString()}</span></span>
                <span style={{ color: pos.realizedPnl >= 0 ? T.green : T.red, fontWeight: 800, fontSize: 13 }}>{pos.realizedPnl >= 0 ? '+' : ''}${pos.realizedPnl.toFixed(2)}</span>
              </div>
              <div style={{ color: T.text, fontSize: 11, marginTop: 2 }}>Entry ${pos.entryPrice.toFixed(2)} → Exit ${pos.exitPrice.toFixed(2)} | {pos.leverage}x | Fee -${(pos.fee || 0).toFixed(4)}</div>
            </Card>
          ))
      )}
    </div>
  );
};

const WalletScreen = () => {
  const { userData } = useContext(AuthContext);
  const closed = userData?.closedPositions || [];
  const totalFees = closed.reduce((s, p) => s + (p.fee || 0), 0);
  const totalRealized = closed.reduce((s, p) => s + (p.realizedPnl || 0), 0);
  return (
    <div style={{ padding: 14, maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ color: T.white, marginBottom: 16, fontSize: 17 }}>Wallet</h2>
      <Card style={{ marginBottom: 12, padding: 18 }}>
        <div style={{ color: T.text, fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Total Equity</div>
        <div style={{ color: T.white, fontSize: 30, fontWeight: 900 }}>${fmt(userData?.virtualBalance)}</div>
        <div style={{ color: T.text, fontSize: 11, marginTop: 4 }}>Paper trading • No real funds</div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[['Realized PnL', `${totalRealized >= 0 ? '+' : ''}$${totalRealized.toFixed(2)}`, totalRealized >= 0 ? T.green : T.red], ['Trades', closed.length, T.white], ['Fees Paid', `-$${totalFees.toFixed(4)}`, T.red]].map(([l, v, c]) => (
          <Card key={l} style={{ padding: 11, textAlign: 'center' }}><div style={{ color: T.text, fontSize: 10, marginBottom: 3 }}>{l}</div><div style={{ color: c, fontWeight: 800, fontSize: 13 }}>{v}</div></Card>
        ))}
      </div>
      <Card style={{ padding: 15 }}>
        <div style={{ color: T.white, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>Assets</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#26A17B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>₮</div>
            <div><div style={{ color: T.white, fontWeight: 600, fontSize: 13 }}>USDT</div><div style={{ color: T.text, fontSize: 11 }}>TetherUS</div></div>
          </div>
          <div style={{ textAlign: 'right' }}><div style={{ color: T.white, fontWeight: 700, fontSize: 13 }}>{fmt(userData?.virtualBalance)}</div><div style={{ color: T.text, fontSize: 11 }}>Available</div></div>
        </div>
        <Link to="/trade" style={{ display: 'block', textAlign: 'center', background: T.yellow, color: '#000', padding: '10px 0', borderRadius: 6, fontWeight: 800, textDecoration: 'none', fontSize: 13, marginTop: 12 }}>Open a Trade →</Link>
      </Card>
    </div>
  );
};

const LeaderboardScreen = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userData: myData } = useContext(AuthContext);
  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('virtualBalance', 'desc'), limit(20));
        const snap = await getDocs(q);
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);
  return (
    <div style={{ padding: 14, maxWidth: 760, margin: '0 auto' }}>
      <h2 style={{ color: T.white, marginBottom: 14, fontSize: 17 }}>🏆 Leaderboard</h2>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '0.4fr 2fr 1.5fr 1fr', padding: '9px 15px', background: T.card3, borderBottom: `1px solid ${T.border}` }}>
          {['#', 'Trader', 'Balance', 'Trades'].map(h => <span key={h} style={{ color: T.text, fontSize: 11, fontWeight: 700 }}>{h}</span>)}
        </div>
        {loading ? <div style={{ color: T.text, padding: 36, textAlign: 'center' }}>Loading...</div>
          : users.map((u, i) => {
            const isMe = u.uid === myData?.uid;
            return (
              <div key={u.uid} style={{ display: 'grid', gridTemplateColumns: '0.4fr 2fr 1.5fr 1fr', padding: '10px 15px', borderBottom: `1px solid ${T.border2}`, alignItems: 'center', background: isMe ? T.yellowDim : 'transparent' }}>
                <span style={{ color: i < 3 ? T.yellow : T.text, fontWeight: 700, fontSize: i < 3 ? 15 : 12 }}>{['🥇', '🥈', '🥉'][i] || i + 1}</span>
                <span style={{ color: isMe ? T.yellow : T.white, fontSize: 13, fontWeight: isMe ? 700 : 400 }}>{u.name || 'Anon'}{isMe ? ' (you)' : ''}</span>
                <span style={{ color: T.green, fontWeight: 700, fontSize: 13 }}>${fmt(u.virtualBalance)}</span>
                <span style={{ color: T.text2, fontSize: 12 }}>{(u.closedPositions || []).length}</span>
              </div>
            );
          })}
      </Card>
    </div>
  );
};

const AuthCard = ({ sub, children }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: 14 }}>
    <Card style={{ width: '100%', maxWidth: 360, padding: '26px 22px' }}>
      <div style={{ color: T.yellow, fontWeight: 900, fontSize: 17, textAlign: 'center', marginBottom: 3 }}>⚡ ATHARVA CAPITAL</div>
      <div style={{ color: T.text, textAlign: 'center', marginBottom: 22, fontSize: 12 }}>{sub}</div>
      {children}
    </Card>
  </div>
);

const LoginScreen = () => {
  const { login } = useContext(AuthContext);
  const nav = useNavigate();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [load, setLoad] = useState(false);
  const go = async () => {
    if (!email || !pw) return setErr('Fill all fields.');
    setLoad(true); setErr('');
    try { await login(email, pw); nav('/dashboard'); }
    catch (e) { setErr(e.code === 'auth/invalid-credential' ? 'Invalid credentials.' : e.message); }
    setLoad(false);
  };
  return (
    <AuthCard sub="Welcome back">
      <div style={{ color: T.text, fontSize: 11, marginBottom: 3 }}>Email</div>
      <Inp type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} style={{ marginBottom: 11 }} />
      <div style={{ color: T.text, fontSize: 11, marginBottom: 3 }}>Password</div>
      <Inp type="password" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} style={{ marginBottom: 15 }} onKeyDown={e => e.key === 'Enter' && go()} />
      {err && <div style={{ color: T.red, fontSize: 12, marginBottom: 9 }}>{err}</div>}
      <Btn onClick={go} disabled={load}>{load ? 'Logging in...' : 'Login'}</Btn>
      <div style={{ textAlign: 'center', marginTop: 13, color: T.text, fontSize: 12 }}>New? <Link to="/signup" style={{ color: T.yellow, fontWeight: 700, textDecoration: 'none' }}>Create Account</Link></div>
    </AuthCard>
  );
};

const SignupScreen = () => {
  const { signUp } = useContext(AuthContext);
  const nav = useNavigate();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [load, setLoad] = useState(false);
  const go = async () => {
    if (!email || !pw) return setErr('Fill all fields.');
    if (pw.length < 6) return setErr('Password min 6 chars.');
    setLoad(true); setErr('');
    try { await signUp(email, pw, name); nav('/dashboard'); }
    catch (e) { setErr(e.code === 'auth/email-already-in-use' ? 'Email already used.' : e.message); }
    setLoad(false);
  };
  return (
    <AuthCard sub="Get $10,000 virtual USDT — free">
      <div style={{ color: T.text, fontSize: 11, marginBottom: 3 }}>Name</div>
      <Inp placeholder="Atharva" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 9 }} />
      <div style={{ color: T.text, fontSize: 11, marginBottom: 3 }}>Email</div>
      <Inp type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} style={{ marginBottom: 9 }} />
      <div style={{ color: T.text, fontSize: 11, marginBottom: 3 }}>Password</div>
      <Inp type="password" placeholder="Min 6 chars" value={pw} onChange={e => setPw(e.target.value)} style={{ marginBottom: 15 }} onKeyDown={e => e.key === 'Enter' && go()} />
      {err && <div style={{ color: T.red, fontSize: 12, marginBottom: 9 }}>{err}</div>}
      <Btn onClick={go} disabled={load}>{load ? 'Creating...' : 'Create Account & Get $10,000'}</Btn>
      <div style={{ textAlign: 'center', marginTop: 13, color: T.text, fontSize: 12 }}>Have account? <Link to="/login" style={{ color: T.yellow, fontWeight: 700, textDecoration: 'none' }}>Login</Link></div>
    </AuthCard>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <PriceProvider>
        <Router>
          <div style={{ background: T.bg, minHeight: '100vh', color: T.white, fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif' }}>
            <Navbar />
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/markets" element={<MarketsScreen />} />
              <Route path="/trade" element={<TradeScreen />} />
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/signup" element={<SignupScreen />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardScreen /></ProtectedRoute>} />
              <Route path="/wallet" element={<ProtectedRoute><WalletScreen /></ProtectedRoute>} />
              <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardScreen /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </Router>
      </PriceProvider>
    </AuthProvider>
  );
}
