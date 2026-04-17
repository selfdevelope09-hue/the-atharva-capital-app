import React, { useState, createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  runTransaction
} from 'firebase/firestore';
import { createChart } from 'lightweight-charts';

// -------------------- Firebase Config --------------------
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

// -------------------- Theme --------------------
const T = {
  bg: '#0b0e11',
  card: '#1e2329',
  card2: '#2b3139',
  yellow: '#f0b90b',
  green: '#02c076',
  red: '#f6465d',
  text: '#848e9c',
  white: '#ffffff',
  border: '#2b2f36'
};

// -------------------- Context Providers --------------------
const AuthContext = createContext();
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (uid) => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      data.positions = data.positions || [];
      data.closedPositions = data.closedPositions || [];
      data.watchlist = data.watchlist || [];
      setUserData(data);
      return data;
    }
    return null;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await fetchUserData(u.uid);
      else setUserData(null);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signUp = async (email, password, name) => {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    const data = {
      uid: res.user.uid,
      email,
      name: name || 'Trader',
      virtualBalance: 10000,
      positions: [],
      closedPositions: [],
      watchlist: [],
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', res.user.uid), data);
    setUserData(data);
  };

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);
  const refreshUser = async () => {
    if (user) return await fetchUserData(user.uid);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, signUp, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

const PriceContext = createContext({});
const PriceProvider = ({ children }) => {
  const [prices, setPrices] = useState({});
  useEffect(() => {
    let ws;
    const connect = () => {
      ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        const updates = {};
        data.forEach((coin) => {
          if (coin.s.endsWith('USDT')) {
            updates[coin.s] = {
              price: parseFloat(coin.c),
              close: parseFloat(coin.c),
              open: parseFloat(coin.o),
              change: (((parseFloat(coin.c) - parseFloat(coin.o)) / parseFloat(coin.o)) * 100).toFixed(2)
            };
          }
        });
        setPrices((prev) => ({ ...prev, ...updates }));
      };
      ws.onclose = () => setTimeout(connect, 3000);
    };
    connect();
    return () => ws && ws.close();
  }, []);
  return <PriceContext.Provider value={prices}>{children}</PriceContext.Provider>;
};

// -------------------- Protected Route --------------------
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div style={{ color: T.yellow, textAlign: 'center', marginTop: 80 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

// -------------------- UI Components --------------------
const Input = ({ style, ...props }) => (
  <input
    style={{
      backgroundColor: T.card2,
      border: `1px solid ${T.border}`,
      color: T.white,
      padding: '12px 14px',
      borderRadius: 6,
      width: '100%',
      fontSize: 14,
      outline: 'none',
      boxSizing: 'border-box',
      ...style
    }}
    {...props}
  />
);

const Btn = ({ children, style, color, ...props }) => (
  <button
    style={{
      backgroundColor: color || T.yellow,
      color: color ? T.white : '#000',
      border: 'none',
      padding: '13px 20px',
      borderRadius: 6,
      fontWeight: 'bold',
      fontSize: 15,
      cursor: 'pointer',
      width: '100%',
      opacity: props.disabled ? 0.6 : 1,
      ...style
    }}
    {...props}
  >
    {children}
  </button>
);

const Card = ({ children, style }) => (
  <div style={{ backgroundColor: T.card, borderRadius: 12, padding: 20, ...style }}>{children}</div>
);

// -------------------- Navbar (Mobile Responsive) --------------------
const Navbar = () => {
  const { user, userData, logout } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    ['/', 'Home'],
    ['/markets', 'Markets'],
    ['/trade', 'Trade'],
    ['/dashboard', 'Dashboard'],
    ['/wallet', 'Wallet'],
    ['/leaderboard', 'Leaderboard']
  ];

  return (
    <nav style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', height: 56, maxWidth: 1200, margin: '0 auto' }}>
        <Link to="/" style={{ color: T.yellow, fontWeight: 'bold', textDecoration: 'none', fontSize: 17 }}>⚡ ATHARVA CAPITAL</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Desktop Links */}
          <div style={{ display: 'none', gap: 16, '@media (min-width: 768px)': { display: 'flex' } }} className="desktop-nav">
            {links.map(([p, l]) => (
              <Link key={p} to={p} style={{ color: T.text, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{l}</Link>
            ))}
          </div>
          {/* Mobile Hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', color: T.white, fontSize: 20, display: 'block', '@media (min-width: 768px)': { display: 'none' } }}>☰</button>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ color: T.yellow, fontSize: 13, fontWeight: 600 }}>
                ${parseFloat(userData?.virtualBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <button onClick={logout} style={{ background: 'none', border: `1px solid ${T.red}`, color: T.red, padding: '5px 14px', borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>Logout</button>
            </div>
          ) : (
            <Link to="/login" style={{ backgroundColor: T.yellow, color: '#000', padding: '7px 18px', borderRadius: 5, textDecoration: 'none', fontWeight: 'bold', fontSize: 13 }}>Login</Link>
          )}
        </div>
      </div>
      {/* Mobile Menu */}
      {menuOpen && (
        <div style={{ backgroundColor: T.card2, padding: 12, borderTop: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {links.map(([p, l]) => (
            <Link key={p} to={p} onClick={() => setMenuOpen(false)} style={{ color: T.white, textDecoration: 'none', fontSize: 16 }}>{l}</Link>
          ))}
        </div>
      )}
      {/* Responsive fix */}
      <style>{`
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
          button[aria-label="menu"] { display: none !important; }
        }
      `}</style>
    </nav>
  );
};

// -------------------- Home Screen --------------------
const HomeScreen = () => {
  const prices = useContext(PriceContext);
  const { user } = useContext(AuthContext);
  const topCoins = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
  return (
    <div style={{ padding: '40px 16px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 60 }}>
        <h1 style={{ color: T.white, fontSize: 'clamp(28px, 8vw, 42px)', fontWeight: 900, marginBottom: 12 }}>
          THE ATHARVA <span style={{ color: T.yellow }}>CAPITAL</span>
        </h1>
        <p style={{ color: T.text, fontSize: 18, maxWidth: 500, margin: '0 auto 28px' }}>Paper Trade Crypto with $0 risk. Master the markets before going live.</p>
        {!user && (
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" style={{ backgroundColor: T.yellow, color: '#000', padding: '13px 32px', borderRadius: 8, fontWeight: 'bold', textDecoration: 'none', fontSize: 16 }}>Start Trading Free</Link>
            <Link to="/markets" style={{ backgroundColor: T.card, color: T.white, padding: '13px 32px', borderRadius: 8, fontWeight: 'bold', textDecoration: 'none', fontSize: 16, border: `1px solid ${T.border}` }}>View Markets</Link>
          </div>
        )}
      </div>
      <h2 style={{ color: T.white, fontSize: 20, marginBottom: 16 }}>🔴 Live Market</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 40 }}>
        {topCoins.map((sym) => {
          const d = prices[sym];
          const chg = d ? parseFloat(d.change) : 0;
          return (
            <Link key={sym} to={`/trade?symbol=${sym}`} style={{ textDecoration: 'none' }}>
              <Card style={{ cursor: 'pointer', borderLeft: `3px solid ${chg >= 0 ? T.green : T.red}` }}>
                <div style={{ color: T.white, fontWeight: 700, fontSize: 15 }}>{sym.replace('USDT', '')}</div>
                <div style={{ color: T.white, fontSize: 18, fontWeight: 800, margin: '6px 0' }}>${d ? d.price.toLocaleString() : '—'}</div>
                <div style={{ color: chg >= 0 ? T.green : T.red, fontSize: 13, fontWeight: 600 }}>{chg >= 0 ? '+' : ''}{chg}%</div>
              </Card>
            </Link>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[['💰', '$10,000 Virtual Balance'], ['📊', 'Drag‑Drop SL/TP'], ['⚡', 'Real‑time Binance'], ['🔒', 'Secure Firebase']].map(([icon, title]) => (
          <Card key={title}><div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div><div style={{ color: T.white, fontWeight: 700 }}>{title}</div></Card>
        ))}
      </div>
    </div>
  );
};

// -------------------- Markets Screen --------------------
const MarketsScreen = () => {
  const prices = useContext(PriceContext);
  const { user, userData, refreshUser } = useContext(AuthContext);
  const [search, setSearch] = useState('');
  const coins = Object.entries(prices).filter(([sym]) => sym.includes(search.toUpperCase())).sort((a, b) => b[1].price - a[1].price).slice(0, 60);

  const toggleWatchlist = async (symbol) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const isInWatchlist = userData?.watchlist?.includes(symbol);
    try {
      await updateDoc(userRef, { watchlist: isInWatchlist ? arrayRemove(symbol) : arrayUnion(symbol) });
      await refreshUser();
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ padding: 16, maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ color: T.white, marginBottom: 16 }}>Markets</h2>
      <Input placeholder="Search e.g. BTC, ETH..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320, marginBottom: 20 }} />
      <div style={{ backgroundColor: T.card, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 0.5fr', padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
          {['Pair', 'Price', '24h Change', 'Action', ''].map((h) => <span key={h} style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{h}</span>)}
        </div>
        {coins.length === 0 ? <div style={{ color: T.text, padding: 40, textAlign: 'center' }}>Loading prices...</div>
          : coins.map(([sym, d]) => {
            const chg = parseFloat(d.change);
            const isWatched = userData?.watchlist?.includes(sym);
            return (
              <div key={sym} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 0.5fr', padding: '14px 16px', borderBottom: `1px solid ${T.border}`, alignItems: 'center' }}>
                <span style={{ color: T.white, fontWeight: 700 }}>{sym.replace('USDT', '')}<span style={{ color: T.text, fontWeight: 400 }}>/USDT</span></span>
                <span style={{ color: T.white, fontWeight: 600 }}>${d.price.toLocaleString()}</span>
                <span style={{ color: chg >= 0 ? T.green : T.red, backgroundColor: chg >= 0 ? 'rgba(2,192,118,0.1)' : 'rgba(246,70,93,0.1)', padding: '3px 10px', borderRadius: 4, fontSize: 13, display: 'inline-block', fontWeight: 600, width: 'fit-content' }}>{chg >= 0 ? '+' : ''}{chg}%</span>
                <Link to={`/trade?symbol=${sym}`} style={{ color: T.yellow, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Trade →</Link>
                <button onClick={() => toggleWatchlist(sym)} style={{ background: 'none', border: 'none', color: isWatched ? T.yellow : T.text, cursor: 'pointer', fontSize: 18, padding: 0 }}>{isWatched ? '★' : '☆'}</button>
              </div>
            );
          })}
      </div>
    </div>
  );
};

// -------------------- TradeScreen with Draggable SL/TP & Live PnL --------------------
const TradeScreen = () => {
  const prices = useContext(PriceContext);
  const { user, userData, refreshUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const hashParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
  const [symbol, setSymbol] = useState(hashParams.get('symbol') || 'BTCUSDT');
  const [orderType, setOrderType] = useState('Market');
  const [side, setSide] = useState('BUY');
  const [amount, setAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartFullscreen, setChartFullscreen] = useState(false);

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const tpLineRef = useRef(null);
  const slLineRef = useRef(null);
  const entryLineRef = useRef(null);
  const [chartReady, setChartReady] = useState(false);

  const liveData = prices[symbol] || { price: 0, change: '0.00' };
  const currentPrice = liveData.price;

  const [openPosition, setOpenPosition] = useState(null); // current open position for this symbol

  // Fetch open position for this symbol from userData
  useEffect(() => {
    if (userData?.positions) {
      const pos = userData.positions.find(p => p.symbol === symbol && p.status === 'OPEN');
      setOpenPosition(pos || null);
      if (pos) {
        setSide(pos.type === 'LONG' ? 'BUY' : 'SELL');
        setLeverage(pos.leverage);
        if (pos.tp) setTpPrice(pos.tp.toString());
        if (pos.sl) setSlPrice(pos.sl.toString());
      }
    }
  }, [userData, symbol]);

  // Calculate unrealized PnL if position exists
  const positionDetails = useCallback(() => {
    if (!openPosition) return null;
    const entry = openPosition.entryPrice;
    const size = openPosition.totalSize;
    const margin = openPosition.margin;
    const lev = openPosition.leverage;
    const cp = currentPrice;
    let pnl = 0;
    if (openPosition.type === 'LONG') {
      pnl = ((cp - entry) / entry) * size;
    } else {
      pnl = ((entry - cp) / entry) * size;
    }
    const roe = (pnl / margin) * 100;
    return { pnl, roe, size, margin, lev, entry };
  }, [openPosition, currentPrice]);

  const posDet = positionDetails();

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartFullscreen ? 600 : 400,
      layout: { background: { color: T.card }, textColor: T.text },
      grid: { vertLines: { color: T.border }, horzLines: { color: T.border } },
      crosshair: { mode: 1 },
      timeScale: { timeVisible: true, secondsVisible: false }
    });
    chartRef.current = chart;
    const candleSeries = chart.addCandlestickSeries({
      upColor: T.green, downColor: T.red, borderUpColor: T.green, borderDownColor: T.red, wickUpColor: T.green, wickDownColor: T.red
    });
    candleSeriesRef.current = candleSeries;

    // Fetch historical data from Binance
    const fetchHistory = async () => {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=200`);
      const data = await res.json();
      const bars = data.map(d => ({
        time: Math.floor(d[0] / 1000),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4])
      }));
      candleSeries.setData(bars);
    };
    fetchHistory();
    setChartReady(true);

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, chartFullscreen]);

  // Update real-time price on chart
  useEffect(() => {
    if (!candleSeriesRef.current || !currentPrice) return;
    const lastBar = candleSeriesRef.current.data().slice(-1)[0];
    if (lastBar && Date.now() / 1000 - lastBar.time < 60) {
      candleSeriesRef.current.update({ ...lastBar, close: currentPrice });
    }
  }, [currentPrice]);

  // Manage TP/SL/Entry lines
  useEffect(() => {
    if (!chartRef.current || !chartReady || !candleSeriesRef.current) return;
    const chart = chartRef.current;
    // Remove old lines
    if (tpLineRef.current) { chart.removePriceLine(tpLineRef.current); tpLineRef.current = null; }
    if (slLineRef.current) { chart.removePriceLine(slLineRef.current); slLineRef.current = null; }
    if (entryLineRef.current) { chart.removePriceLine(entryLineRef.current); entryLineRef.current = null; }

    const entry = openPosition?.entryPrice;
    const tp = tpPrice ? parseFloat(tpPrice) : null;
    const sl = slPrice ? parseFloat(slPrice) : null;

    if (entry) {
      entryLineRef.current = chart.addPriceLine({
        price: entry,
        color: '#888888',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `Entry ${entry.toFixed(2)}`
      });
    }
    if (tp) {
      tpLineRef.current = chart.addPriceLine({
        price: tp,
        color: T.green,
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `TP ${tp.toFixed(2)}`,
        draggable: true,
        onDrag: (newPrice) => setTpPrice(newPrice.toFixed(2))
      });
    }
    if (sl) {
      slLineRef.current = chart.addPriceLine({
        price: sl,
        color: T.red,
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `SL ${sl.toFixed(2)}`,
        draggable: true,
        onDrag: (newPrice) => setSlPrice(newPrice.toFixed(2))
      });
    }
  }, [chartReady, openPosition, tpPrice, slPrice, currentPrice]);

  const handleTrade = async () => {
    if (!user) return navigate('/login');
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return setMsg({ t: 'error', m: 'Enter a valid amount.' });
    const amt = parseFloat(amount);
    const marginReq = amt / leverage;
    if (marginReq > (userData?.virtualBalance || 0)) return setMsg({ t: 'error', m: `Insufficient balance. Need $${marginReq.toFixed(2)} margin.` });

    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const execPrice = orderType === 'Market' ? currentPrice : parseFloat(limitPrice || currentPrice);
      const newPos = {
        symbol, type: side === 'BUY' ? 'LONG' : 'SHORT', entryPrice: execPrice, leverage, margin: marginReq,
        totalSize: amt, tp: tpPrice ? parseFloat(tpPrice) : null, sl: slPrice ? parseFloat(slPrice) : null,
        status: 'OPEN', time: new Date().toISOString()
      };
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw 'User does not exist!';
        const currentBalance = userDoc.data().virtualBalance;
        if (marginReq > currentBalance) throw 'Insufficient balance.';
        transaction.update(userRef, { virtualBalance: increment(-marginReq), positions: arrayUnion(newPos) });
      });
      await refreshUser();
      setMsg({ t: 'success', m: `✅ ${side === 'BUY' ? 'LONG' : 'SHORT'} ${symbol} at $${execPrice.toFixed(2)}` });
      setAmount(''); setTpPrice(''); setSlPrice('');
    } catch (e) { setMsg({ t: 'error', m: e.message }); }
    setLoading(false);
  };

  const handleClosePosition = async () => {
    if (!openPosition) return;
    const pos = openPosition;
    const fee = pos.totalSize * 0.0005;
    let pnl = 0;
    if (pos.type === 'LONG') pnl = ((currentPrice - pos.entryPrice) / pos.entryPrice) * pos.totalSize;
    else pnl = ((pos.entryPrice - currentPrice) / pos.entryPrice) * pos.totalSize;
    const finalPnl = pnl - fee;
    const closedPos = { ...pos, exitPrice: currentPrice, realizedPnl: finalPnl, closedAt: new Date().toISOString(), status: 'CLOSED' };
    try {
      const userRef = doc(db, 'users', user.uid);
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const currentPositions = userDoc.data().positions || [];
        const newPositions = currentPositions.filter(p => !(p.symbol === symbol && p.status === 'OPEN'));
        const closedPositions = userDoc.data().closedPositions || [];
        transaction.update(userRef, {
          virtualBalance: increment(pos.margin + finalPnl),
          positions: newPositions,
          closedPositions: [...closedPositions, closedPos]
        });
      });
      await refreshUser();
      setMsg({ t: 'success', m: `Position closed. PnL: ${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)}` });
    } catch (e) { setMsg({ t: 'error', m: e.message }); }
  };

  return (
    <div style={{ padding: 16, maxWidth: chartFullscreen ? '100%' : 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'].map(s => (
          <button key={s} onClick={() => setSymbol(s)} style={{ backgroundColor: symbol === s ? T.yellow : T.card2, color: symbol === s ? '#000' : T.white, border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: symbol === s ? 700 : 400 }}>{s.replace('USDT', '')}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: chartFullscreen ? '1fr' : '1fr 300px', gap: 16 }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: T.white, fontWeight: 700 }}>{symbol.replace('USDT', '')}/USDT</span>
              <span style={{ marginLeft: 12, color: T.green }}>${currentPrice.toLocaleString()}</span>
              <span style={{ marginLeft: 8, color: parseFloat(liveData.change) >= 0 ? T.green : T.red }}>{liveData.change}%</span>
            </div>
            <button onClick={() => setChartFullscreen(!chartFullscreen)} style={{ background: T.card2, border: 'none', color: T.white, padding: '4px 12px', borderRadius: 4, cursor: 'pointer' }}>{chartFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</button>
          </div>
          {posDet && (
            <div style={{ padding: '8px 12px', backgroundColor: T.card2, display: 'flex', flexWrap: 'wrap', gap: 16, borderBottom: `1px solid ${T.border}` }}>
              <span>Size: <b>${posDet.size.toFixed(2)}</b></span>
              <span>Leverage: <b>{posDet.lev}x</b></span>
              <span>PnL: <b style={{ color: posDet.pnl >= 0 ? T.green : T.red }}>{posDet.pnl >= 0 ? '+' : ''}{posDet.pnl.toFixed(2)} ({(posDet.pnl/posDet.margin*100).toFixed(2)}%)</b></span>
              {openPosition && <button onClick={handleClosePosition} style={{ marginLeft: 'auto', background: T.red, border: 'none', color: T.white, padding: '6px 16px', borderRadius: 4, cursor: 'pointer' }}>Close Position</button>}
            </div>
          )}
          <div ref={chartContainerRef} style={{ width: '100%', height: chartFullscreen ? 600 : 400 }} />
        </Card>
        {!chartFullscreen && (
          <Card>
            <div style={{ display: 'flex', backgroundColor: T.card2, borderRadius: 6, marginBottom: 14 }}>
              {['Market', 'Limit'].map(t => <button key={t} onClick={() => setOrderType(t)} style={{ flex: 1, padding: 8, border: 'none', borderRadius: 6, backgroundColor: orderType === t ? T.yellow : 'transparent', color: orderType === t ? '#000' : T.text, fontWeight: 600 }}>{t}</button>)}
            </div>
            <div style={{ display: 'flex', backgroundColor: T.card2, borderRadius: 6, marginBottom: 14 }}>
              <button onClick={() => setSide('BUY')} style={{ flex: 1, padding: 10, border: 'none', borderRadius: 6, backgroundColor: side === 'BUY' ? T.green : 'transparent', color: T.white, fontWeight: 700 }}>Buy/Long</button>
              <button onClick={() => setSide('SELL')} style={{ flex: 1, padding: 10, border: 'none', borderRadius: 6, backgroundColor: side === 'SELL' ? T.red : 'transparent', color: T.white, fontWeight: 700 }}>Sell/Short</button>
            </div>
            {userData && <div style={{ color: T.text, fontSize: 12, marginBottom: 10 }}>Available: <span style={{ color: T.white }}>${userData.virtualBalance?.toFixed(2)}</span></div>}
            {orderType === 'Limit' && <div style={{ marginBottom: 10 }}><label>Limit Price</label><Input value={limitPrice} onChange={e => setLimitPrice(e.target.value)} type="number" /></div>}
            <div style={{ marginBottom: 10 }}><label>Amount (USDT)</label><Input value={amount} onChange={e => setAmount(e.target.value)} type="number" /></div>
            <div style={{ marginBottom: 10 }}>
              <label>Leverage: <span style={{ color: T.yellow }}>{leverage}x</span></label>
              <input type="range" min={1} max={125} value={leverage} onChange={e => setLeverage(parseInt(e.target.value))} style={{ width: '100%', accentColor: T.yellow }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div><label>Take Profit</label><Input placeholder="Drag on chart" value={tpPrice} onChange={e => setTpPrice(e.target.value)} type="number" /></div>
              <div><label>Stop Loss</label><Input placeholder="Drag on chart" value={slPrice} onChange={e => setSlPrice(e.target.value)} type="number" /></div>
            </div>
            {msg && <div style={{ backgroundColor: msg.t === 'success' ? 'rgba(2,192,118,0.15)' : 'rgba(246,70,93,0.15)', color: msg.t === 'success' ? T.green : T.red, padding: '10px', borderRadius: 6, marginBottom: 12 }}>{msg.m}</div>}
            {user ? <Btn color={side === 'BUY' ? T.green : T.red} onClick={handleTrade} disabled={loading}>{loading ? 'Opening...' : `${side === 'BUY' ? 'Buy/Long' : 'Sell/Short'} ${symbol.replace('USDT', '')}`}</Btn>
              : <Link to="/login" style={{ display: 'block', textAlign: 'center', backgroundColor: T.yellow, color: '#000', padding: 13, borderRadius: 6, fontWeight: 'bold', textDecoration: 'none' }}>Login to Trade</Link>}
          </Card>
        )}
      </div>
    </div>
  );
};

// -------------------- Dashboard --------------------
const DashboardScreen = () => {
  const { user, userData, refreshUser } = useContext(AuthContext);
  const prices = useContext(PriceContext);
  const [closeMsg, setCloseMsg] = useState(null);

  const positions = userData?.positions || [];
  let totalUnrealizedPnL = 0;
  const enriched = positions.map((pos) => {
    const cp = prices[pos.symbol]?.price || pos.entryPrice;
    const pd = pos.type === 'LONG' ? cp - pos.entryPrice : pos.entryPrice - cp;
    const pnl = (pd / pos.entryPrice) * pos.totalSize;
    totalUnrealizedPnL += pnl;
    return { ...pos, currentPrice: cp, pnl };
  });

  const handleClose = async (index) => {
    const pos = enriched[index];
    const fee = pos.totalSize * 0.0005;
    const finalPnl = pos.pnl - fee;
    const closedPosition = { ...pos, exitPrice: pos.currentPrice, realizedPnl: finalPnl, closedAt: new Date().toISOString(), status: 'CLOSED' };
    try {
      const userRef = doc(db, 'users', user.uid);
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const newPositions = userDoc.data().positions.filter((_, i) => i !== index);
        const closedPositions = userDoc.data().closedPositions || [];
        transaction.update(userRef, { virtualBalance: increment(pos.margin + finalPnl), positions: newPositions, closedPositions: [...closedPositions, closedPosition] });
      });
      await refreshUser();
      setCloseMsg({ t: finalPnl >= 0 ? 'success' : 'error', m: `Closed. PnL: ${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)}` });
    } catch (e) { setCloseMsg({ t: 'error', m: e.message }); }
  };

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ color: T.white }}>Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        <Card><div style={{ color: T.text }}>Balance</div><div style={{ color: T.white, fontSize: 24 }}>${userData?.virtualBalance?.toFixed(2)}</div></Card>
        <Card><div style={{ color: T.text }}>Unrealized PnL</div><div style={{ color: totalUnrealizedPnL >= 0 ? T.green : T.red, fontSize: 24 }}>{totalUnrealizedPnL >= 0 ? '+' : ''}{totalUnrealizedPnL.toFixed(2)}</div></Card>
        <Card><div style={{ color: T.text }}>Open Positions</div><div style={{ color: T.white, fontSize: 24 }}>{positions.length}</div></Card>
      </div>
      {closeMsg && <div style={{ backgroundColor: closeMsg.t === 'success' ? 'rgba(2,192,118,0.15)' : 'rgba(246,70,93,0.15)', color: closeMsg.t === 'success' ? T.green : T.red, padding: 12, borderRadius: 8, marginBottom: 16 }}>{closeMsg.m}</div>}
      <h3>Open Positions</h3>
      {enriched.length === 0 ? <Card style={{ textAlign: 'center', padding: 30 }}>No open positions. <Link to="/trade">Start Trading</Link></Card>
        : enriched.map((pos, i) => (
          <Card key={i} style={{ marginBottom: 12, borderLeft: `3px solid ${pos.type === 'LONG' ? T.green : T.red}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><b style={{ color: pos.type === 'LONG' ? T.green : T.red }}>{pos.symbol} {pos.type} {pos.leverage}x</b></span>
              <button onClick={() => handleClose(i)} style={{ background: T.red, border: 'none', color: T.white, padding: '6px 12px', borderRadius: 4 }}>Close</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 10 }}>
              <div>Entry: ${pos.entryPrice}</div><div>Mark: ${pos.currentPrice}</div><div>Size: ${pos.totalSize}</div>
              <div>Margin: ${pos.margin}</div><div style={{ color: pos.pnl >= 0 ? T.green : T.red }}>PnL: {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}</div><div></div>
            </div>
          </Card>
        ))}
      <h3 style={{ marginTop: 32 }}>Order History</h3>
      {userData?.closedPositions?.length > 0 ? userData.closedPositions.slice().reverse().map((pos, idx) => (
        <Card key={idx} style={{ marginBottom: 8 }}>
          <div><b>{pos.symbol} {pos.type}</b> <span style={{ color: T.text }}>{new Date(pos.closedAt).toLocaleString()}</span></div>
          <div>Entry ${pos.entryPrice} → Exit ${pos.exitPrice} | PnL: <span style={{ color: pos.realizedPnl >= 0 ? T.green : T.red }}>{pos.realizedPnl >= 0 ? '+' : ''}{pos.realizedPnl.toFixed(2)}</span></div>
        </Card>
      )) : <Card style={{ padding: 30, textAlign: 'center', color: T.text }}>No closed trades yet.</Card>}
    </div>
  );
};

// -------------------- Wallet, Leaderboard, Auth Screens (Same as before, but included) --------------------
// (I'll keep them concise but fully functional)
const WalletScreen = () => {
  const { user, userData, refreshUser } = useContext(AuthContext);
  const [msg, setMsg] = useState(null);
  const handleTopUp = async (amt) => {
    try { await updateDoc(doc(db, 'users', user.uid), { virtualBalance: increment(amt) }); await refreshUser(); setMsg({ t: 'success', m: `Added $${amt}` }); } catch (e) { setMsg({ t: 'error', m: e.message }); }
  };
  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <h2>Wallet</h2>
      <Card><div style={{ fontSize: 36 }}>${userData?.virtualBalance?.toFixed(2)}</div></Card>
      <Card style={{ marginTop: 20 }}>
        <h3>Top Up</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={() => handleTopUp(1000)}>+$1,000</Btn>
          <Btn onClick={() => handleTopUp(10000)}>+$10,000</Btn>
        </div>
        {msg && <div style={{ marginTop: 10, color: msg.t === 'success' ? T.green : T.red }}>{msg.m}</div>}
      </Card>
    </div>
  );
};

const LeaderboardScreen = () => {
  const [users, setUsers] = useState([]);
  useEffect(() => { getDocs(query(collection(db, 'users'), orderBy('virtualBalance', 'desc'), limit(20))).then(snap => setUsers(snap.docs.map(d => d.data()))); }, []);
  return (
    <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
      <h2>Leaderboard</h2>
      <Card>
        {users.map((u, i) => <div key={u.uid} style={{ display: 'flex', justifyContent: 'space-between', padding: 8 }}><span>{i+1}. {u.name || 'Anonymous'}</span><span>${u.virtualBalance?.toFixed(2)}</span></div>)}
      </Card>
    </div>
  );
};

const LoginScreen = () => {
  const { login } = useContext(AuthContext); const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [pass, setPass] = useState(''); const [err, setErr] = useState('');
  const handle = async () => { try { await login(email, pass); navigate('/dashboard'); } catch(e) { setErr(e.message); } };
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Card style={{ maxWidth: 400 }}><h2>Login</h2><Input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} /><Input placeholder="Password" type="password" value={pass} onChange={e=>setPass(e.target.value)} style={{marginTop:10}} /><Btn onClick={handle} style={{marginTop:20}}>Login</Btn>{err&&<div style={{color:T.red}}>{err}</div>}<Link to="/signup">Sign Up</Link></Card></div>
  );
};
const SignupScreen = () => {
  const { signUp } = useContext(AuthContext); const navigate = useNavigate();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pass, setPass] = useState(''); const [err, setErr] = useState('');
  const handle = async () => { try { await signUp(email, pass, name); navigate('/dashboard'); } catch(e) { setErr(e.message); } };
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Card style={{ maxWidth: 400 }}><h2>Sign Up</h2><Input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} /><Input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{marginTop:10}} /><Input placeholder="Password" type="password" value={pass} onChange={e=>setPass(e.target.value)} style={{marginTop:10}} /><Btn onClick={handle} style={{marginTop:20}}>Create Account</Btn>{err&&<div style={{color:T.red}}>{err}</div>}</Card></div>
  );
};

// -------------------- App --------------------
export default function App() {
  return (
    <AuthProvider>
      <PriceProvider>
        <Router>
          <div style={{ backgroundColor: T.bg, minHeight: '100vh', color: T.white, fontFamily: 'sans-serif' }}>
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
