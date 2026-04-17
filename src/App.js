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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

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
  border: '#2b2f36',
  tpColor: '#02c076',
  slColor: '#f6465d',
  entryColor: '#f0b90b'
};

// -------------------- Context --------------------
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
      uid: res.user.uid, email, name: name || 'Trader',
      virtualBalance: 10000, positions: [], closedPositions: [],
      watchlist: [], createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', res.user.uid), data);
    setUserData(data);
  };

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);
  const refreshUser = async () => { if (user) return await fetchUserData(user.uid); };

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
              price: parseFloat(coin.c).toFixed(2),
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
  if (loading) return <div style={{ color: T.yellow, textAlign: 'center', marginTop: 80, fontSize: 18 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

// -------------------- UI Components --------------------
const Input = ({ style, ...props }) => (
  <input
    style={{
      backgroundColor: T.card2, border: `1px solid ${T.border}`,
      color: T.white, padding: '10px 12px', borderRadius: 6,
      width: '100%', fontSize: 13, outline: 'none', boxSizing: 'border-box', ...style
    }}
    {...props}
  />
);

const Btn = ({ children, style, color, ...props }) => (
  <button
    style={{
      backgroundColor: color || T.yellow, color: color ? T.white : '#000',
      border: 'none', padding: '12px 20px', borderRadius: 6,
      fontWeight: 'bold', fontSize: 14, cursor: 'pointer', width: '100%',
      opacity: props.disabled ? 0.6 : 1, transition: 'opacity 0.2s', ...style
    }}
    {...props}
  >
    {children}
  </button>
);

const Card = ({ children, style }) => (
  <div style={{ backgroundColor: T.card, borderRadius: 12, padding: 20, ...style }}>{children}</div>
);

// -------------------- Navbar --------------------
const Navbar = () => {
  const { user, userData, logout } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', height: 52, backgroundColor: T.card, borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 200 }}>
      <Link to="/" style={{ color: T.yellow, fontWeight: 'bold', textDecoration: 'none', fontSize: 16, letterSpacing: 1 }}>⚡ ATHARVA CAPITAL</Link>
      {/* Desktop */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }} className="desktop-nav">
        {['/', '/markets', '/trade', '/dashboard', '/wallet', '/leaderboard'].map((p) => (
          <Link key={p} to={p} style={{ color: T.text, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
            {p === '/' ? 'Home' : p.slice(1).charAt(0).toUpperCase() + p.slice(2)}
          </Link>
        ))}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: T.yellow, fontSize: 13, fontWeight: 700 }}>
              ${parseFloat(userData?.virtualBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <button onClick={logout} style={{ background: 'none', border: `1px solid ${T.red}`, color: T.red, padding: '4px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>Logout</button>
          </div>
        ) : (
          <Link to="/login" style={{ backgroundColor: T.yellow, color: '#000', padding: '6px 16px', borderRadius: 5, textDecoration: 'none', fontWeight: 'bold', fontSize: 13 }}>Login</Link>
        )}
      </div>
      <style>{`
        @media (max-width: 700px) { .desktop-nav { display: none !important; } .mobile-menu-btn { display: flex !important; } }
        @media (min-width: 701px) { .mobile-menu-btn { display: none !important; } }
      `}</style>
      <div className="mobile-menu-btn" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
        {user && <span style={{ color: T.yellow, fontSize: 12, fontWeight: 700 }}>${parseFloat(userData?.virtualBalance || 0).toFixed(0)}</span>}
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', color: T.white, fontSize: 22, cursor: 'pointer' }}>☰</button>
      </div>
      {menuOpen && (
        <div style={{ position: 'absolute', top: 52, right: 0, backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: '0 0 10px 10px', zIndex: 300, padding: '8px 0', minWidth: 160 }}>
          {['/', '/markets', '/trade', '/dashboard', '/wallet', '/leaderboard'].map((p) => (
            <Link key={p} to={p} onClick={() => setMenuOpen(false)} style={{ display: 'block', color: T.text, textDecoration: 'none', fontSize: 14, padding: '10px 20px' }}>
              {p === '/' ? 'Home' : p.slice(1).charAt(0).toUpperCase() + p.slice(2)}
            </Link>
          ))}
          {user ? <button onClick={() => { logout(); setMenuOpen(false); }} style={{ width: '100%', background: 'none', border: 'none', color: T.red, padding: '10px 20px', textAlign: 'left', cursor: 'pointer', fontSize: 14 }}>Logout</button>
            : <Link to="/login" onClick={() => setMenuOpen(false)} style={{ display: 'block', color: T.yellow, padding: '10px 20px', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>Login</Link>}
        </div>
      )}
    </nav>
  );
};

// -------------------- Chart Overlay - TP/SL Lines --------------------
const ChartOverlay = ({ currentPrice, tp, sl, side, onTpChange, onSlChange }) => {
  const containerRef = useRef(null);
  const isDraggingTp = useRef(false);
  const isDraggingSl = useRef(false);
  const [chartHeight] = useState(420);

  // Price range for mapping (current price ± 3%)
  const priceRange = currentPrice * 0.06;
  const minPrice = currentPrice - priceRange;
  const maxPrice = currentPrice + priceRange;

  const priceToY = (price) => {
    if (!price || !currentPrice) return null;
    const ratio = 1 - ((price - minPrice) / (maxPrice - minPrice));
    return Math.max(0, Math.min(chartHeight, ratio * chartHeight));
  };

  const yToPrice = (y) => {
    const ratio = 1 - (y / chartHeight);
    return minPrice + ratio * (maxPrice - minPrice);
  };

  const entryY = priceToY(currentPrice);
  const tpY = tp ? priceToY(parseFloat(tp)) : null;
  const slY = sl ? priceToY(parseFloat(sl)) : null;

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const y = clientY - rect.top;
    const price = yToPrice(y);
    if (isDraggingTp.current) onTpChange(price.toFixed(2));
    if (isDraggingSl.current) onSlChange(price.toFixed(2));
  }, [currentPrice]);

  const handleMouseUp = () => { isDraggingTp.current = false; isDraggingSl.current = false; };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [handleMouseMove]);

  const lineStyle = (color) => ({
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: color, opacity: 0.85,
    cursor: 'ns-resize', zIndex: 10,
    boxShadow: `0 0 6px ${color}`
  });

  const labelStyle = (color) => ({
    position: 'absolute', right: 8,
    backgroundColor: color, color: '#000',
    padding: '2px 8px', borderRadius: 4,
    fontSize: 11, fontWeight: 700,
    cursor: 'ns-resize', userSelect: 'none',
    transform: 'translateY(-50%)', zIndex: 11, whiteSpace: 'nowrap'
  });

  const handleStyle = (color) => ({
    position: 'absolute', left: '50%', transform: 'translate(-50%, -50%)',
    width: 16, height: 16, borderRadius: '50%',
    backgroundColor: color, cursor: 'ns-resize',
    border: '2px solid #fff', zIndex: 12, boxShadow: `0 0 8px ${color}`
  });

  if (!currentPrice) return null;

  return (
    <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: chartHeight, pointerEvents: 'none', zIndex: 5 }}>
      {/* Entry price line */}
      {entryY !== null && (
        <div style={{ ...lineStyle(T.entryColor), top: entryY, opacity: 0.6, pointerEvents: 'none' }}>
          <span style={{ ...labelStyle(T.entryColor), right: 8 }}>ENTRY ${currentPrice?.toLocaleString()}</span>
        </div>
      )}

      {/* TP Line */}
      {tpY !== null && tp && (
        <div style={{ ...lineStyle(T.tpColor), top: tpY, pointerEvents: 'all' }}
          onMouseDown={() => { isDraggingTp.current = true; }}
          onTouchStart={() => { isDraggingTp.current = true; }}>
          <div style={{ ...handleStyle(T.tpColor), top: 1 }} />
          <span style={{ ...labelStyle(T.tpColor) }}>TP ${parseFloat(tp).toLocaleString()} ▲</span>
        </div>
      )}

      {/* SL Line */}
      {slY !== null && sl && (
        <div style={{ ...lineStyle(T.slColor), top: slY, pointerEvents: 'all' }}
          onMouseDown={() => { isDraggingSl.current = true; }}
          onTouchStart={() => { isDraggingSl.current = true; }}>
          <div style={{ ...handleStyle(T.slColor), top: 1 }} />
          <span style={{ ...labelStyle(T.slColor) }}>SL ${parseFloat(sl).toLocaleString()} ▼</span>
        </div>
      )}

      {/* Profit/Loss Preview */}
      {tp && sl && currentPrice && (
        <div style={{
          position: 'absolute', top: 12, left: 12,
          backgroundColor: 'rgba(30,35,41,0.92)', border: `1px solid ${T.border}`,
          borderRadius: 8, padding: '8px 12px', fontSize: 11, zIndex: 20, pointerEvents: 'none'
        }}>
          <div style={{ color: T.text, marginBottom: 4, fontWeight: 600 }}>RISK/REWARD</div>
          <div style={{ color: T.green }}>🎯 TP: +{(((parseFloat(tp) - currentPrice) / currentPrice) * 100).toFixed(2)}%</div>
          <div style={{ color: T.red }}>🛑 SL: {(((parseFloat(sl) - currentPrice) / currentPrice) * 100).toFixed(2)}%</div>
          {parseFloat(tp) && parseFloat(sl) && (
            <div style={{ color: T.yellow, marginTop: 4, fontWeight: 700 }}>
              R:R = 1:{Math.abs((parseFloat(tp) - currentPrice) / (parseFloat(sl) - currentPrice)).toFixed(2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// -------------------- Trade Screen --------------------
const TradeScreen = () => {
  const prices = useContext(PriceContext);
  const { user, userData, refreshUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const hashParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
  const [symbol, setSymbol] = useState(hashParams.get('symbol') || 'BTCUSDT');
  const [orderType, setOrderType] = useState('Market');
  const [side, setSide] = useState('BUY');
  const [amount, setAmount] = useState('');
  const [amountPercent, setAmountPercent] = useState(null);
  const [limitPrice, setLimitPrice] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const liveData = prices[symbol] || {};
  const currentPrice = parseFloat(liveData.price || 0);
  const execPrice = orderType === 'Market' ? currentPrice : parseFloat(limitPrice || currentPrice);
  const popularPairs = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'];

  const setAmountByPercent = (pct) => {
    const bal = userData?.virtualBalance || 0;
    const amt = ((bal * pct) / 100).toFixed(2);
    setAmount(amt);
    setAmountPercent(pct);
  };

  // Auto-set TP/SL suggestion
  const autoSetTPSL = () => {
    if (!currentPrice) return;
    const tpPct = side === 'BUY' ? 1.02 : 0.98;
    const slPct = side === 'BUY' ? 0.98 : 1.02;
    setTp((currentPrice * tpPct).toFixed(2));
    setSl((currentPrice * slPct).toFixed(2));
  };

  const handleTrade = async () => {
    if (!user) return navigate('/login');
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return setMsg({ t: 'error', m: 'Enter a valid amount.' });
    const amt = parseFloat(amount);
    const marginReq = amt / leverage;
    if (marginReq > (userData?.virtualBalance || 0)) return setMsg({ t: 'error', m: `Insufficient balance. Need $${marginReq.toFixed(2)} margin.` });

    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error('User does not exist!');
        const currentBalance = userDoc.data().virtualBalance;
        if (marginReq > currentBalance) throw new Error('Insufficient balance.');
        const newPosition = {
          symbol, type: side === 'BUY' ? 'LONG' : 'SHORT',
          entryPrice: execPrice, leverage, margin: marginReq,
          totalSize: amt, tp: tp ? parseFloat(tp) : null,
          sl: sl ? parseFloat(sl) : null,
          status: 'OPEN', time: new Date().toISOString()
        };
        transaction.update(userRef, { virtualBalance: increment(-marginReq), positions: arrayUnion(newPosition) });
      });
      await refreshUser();
      setMsg({ t: 'success', m: `✅ ${side === 'BUY' ? 'LONG' : 'SHORT'} ${symbol} at $${execPrice.toFixed(2)}` });
      setAmount(''); setTp(''); setSl(''); setAmountPercent(null);
      if (isMobile) setShowOrderPanel(false);
    } catch (e) { setMsg({ t: 'error', m: e.message }); }
    setLoading(false);
  };

  const marginReq = amount && !isNaN(amount) ? (parseFloat(amount) / leverage).toFixed(2) : null;
  const potentialProfit = amount && tp && currentPrice ? ((Math.abs(parseFloat(tp) - execPrice) / execPrice) * parseFloat(amount) * leverage).toFixed(2) : null;
  const potentialLoss = amount && sl && currentPrice ? ((Math.abs(parseFloat(sl) - execPrice) / execPrice) * parseFloat(amount) * leverage).toFixed(2) : null;

  const OrderForm = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Order type */}
      <div style={{ display: 'flex', backgroundColor: T.card2, borderRadius: 6, marginBottom: 10 }}>
        {['Market', 'Limit'].map((t) => (
          <button key={t} onClick={() => setOrderType(t)} style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, cursor: 'pointer', backgroundColor: orderType === t ? T.yellow : 'transparent', color: orderType === t ? '#000' : T.text, fontWeight: 600, fontSize: 12 }}>{t}</button>
        ))}
      </div>

      {/* Buy/Sell */}
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', marginBottom: 12, border: `1px solid ${T.border}` }}>
        <button onClick={() => setSide('BUY')} style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', backgroundColor: side === 'BUY' ? T.green : 'transparent', color: side === 'BUY' ? '#fff' : T.text, fontWeight: 700, fontSize: 13 }}>▲ Long</button>
        <button onClick={() => setSide('SELL')} style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', backgroundColor: side === 'SELL' ? T.red : 'transparent', color: side === 'SELL' ? '#fff' : T.text, fontWeight: 700, fontSize: 13 }}>▼ Short</button>
      </div>

      {userData && (
        <div style={{ color: T.text, fontSize: 11, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span>Available</span>
          <span style={{ color: T.white, fontWeight: 600 }}>${parseFloat(userData.virtualBalance || 0).toFixed(2)}</span>
        </div>
      )}

      {orderType === 'Limit' && (
        <div style={{ marginBottom: 8 }}>
          <label style={{ color: T.text, fontSize: 11, display: 'block', marginBottom: 3 }}>Limit Price (USDT)</label>
          <Input placeholder={currentPrice.toFixed(2)} value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} type="number" />
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <label style={{ color: T.text, fontSize: 11, display: 'block', marginBottom: 3 }}>Amount (USDT)</label>
        <Input placeholder="e.g. 100" value={amount} onChange={(e) => { setAmount(e.target.value); setAmountPercent(null); }} type="number" />
        <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
          {[25, 50, 75, 100].map((pct) => (
            <button key={pct} onClick={() => setAmountByPercent(pct)} style={{ flex: 1, padding: '4px 0', border: `1px solid ${amountPercent === pct ? T.yellow : T.border}`, borderRadius: 4, backgroundColor: amountPercent === pct ? 'rgba(240,185,11,0.15)' : 'transparent', color: amountPercent === pct ? T.yellow : T.text, fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>{pct}%</button>
          ))}
        </div>
      </div>

      {/* Leverage */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={{ color: T.text, fontSize: 11 }}>Leverage</label>
          <span style={{ color: T.yellow, fontSize: 12, fontWeight: 700 }}>{leverage}x</span>
        </div>
        <input type="range" min={1} max={125} value={leverage} onChange={(e) => setLeverage(parseInt(e.target.value))} style={{ width: '100%', accentColor: T.yellow }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          {[1, 5, 10, 25, 50, 100, 125].map((v) => (
            <button key={v} onClick={() => setLeverage(v)} style={{ background: 'none', border: 'none', color: leverage === v ? T.yellow : T.text, cursor: 'pointer', fontSize: 10, fontWeight: leverage === v ? 800 : 400, padding: '0 2px' }}>{v}x</button>
          ))}
        </div>
      </div>

      {/* TP/SL */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ color: T.text, fontSize: 11, fontWeight: 600 }}>Take Profit / Stop Loss</label>
          <button onClick={autoSetTPSL} style={{ background: 'none', border: `1px solid ${T.border}`, color: T.yellow, padding: '2px 7px', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}>Auto</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div>
            <label style={{ color: T.green, fontSize: 10, display: 'block', marginBottom: 2 }}>🎯 TP Price</label>
            <Input placeholder="Optional" value={tp} onChange={(e) => setTp(e.target.value)} type="number" style={{ borderColor: tp ? T.green : T.border }} />
          </div>
          <div>
            <label style={{ color: T.red, fontSize: 10, display: 'block', marginBottom: 2 }}>🛑 SL Price</label>
            <Input placeholder="Optional" value={sl} onChange={(e) => setSl(e.target.value)} type="number" style={{ borderColor: sl ? T.red : T.border }} />
          </div>
        </div>
        {(tp || sl) && (
          <div style={{ fontSize: 10, color: T.text, marginTop: 4, textAlign: 'center' }}>
            💡 Drag lines on chart to adjust
          </div>
        )}
      </div>

      {/* Order Summary */}
      {amount && !isNaN(amount) && parseFloat(amount) > 0 && (
        <div style={{ backgroundColor: T.card2, borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: T.text }}>Position Size</span>
            <span style={{ color: T.white, fontWeight: 600 }}>${parseFloat(amount).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: marginReq ? 4 : 0 }}>
            <span style={{ color: T.text }}>Margin Required</span>
            <span style={{ color: T.yellow, fontWeight: 700 }}>${marginReq}</span>
          </div>
          {potentialProfit && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: T.text }}>Est. Profit (TP)</span>
              <span style={{ color: T.green, fontWeight: 600 }}>+${potentialProfit}</span>
            </div>
          )}
          {potentialLoss && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: T.text }}>Est. Loss (SL)</span>
              <span style={{ color: T.red, fontWeight: 600 }}>-${potentialLoss}</span>
            </div>
          )}
        </div>
      )}

      {msg && (
        <div style={{ backgroundColor: msg.t === 'success' ? 'rgba(2,192,118,0.15)' : 'rgba(246,70,93,0.15)', color: msg.t === 'success' ? T.green : T.red, padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 10 }}>{msg.m}</div>
      )}

      {user
        ? <Btn color={side === 'BUY' ? T.green : T.red} onClick={handleTrade} disabled={loading}>
            {loading ? 'Opening...' : `${side === 'BUY' ? '▲ Buy / Long' : '▼ Sell / Short'} ${symbol.replace('USDT', '')}`}
          </Btn>
        : <Link to="/login" style={{ display: 'block', textAlign: 'center', backgroundColor: T.yellow, color: '#000', padding: 12, borderRadius: 6, fontWeight: 'bold', textDecoration: 'none', fontSize: 13 }}>Login to Trade</Link>
      }
    </div>
  );

  return (
    <div style={{ height: isMobile ? 'calc(100vh - 52px)' : 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Symbol Tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', overflowX: 'auto', backgroundColor: T.card, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        {popularPairs.map((s) => (
          <button key={s} onClick={() => setSymbol(s)} style={{ backgroundColor: symbol === s ? T.yellow : T.card2, color: symbol === s ? '#000' : T.white, border: 'none', padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontWeight: symbol === s ? 700 : 400, fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>{s.replace('USDT', '')}</button>
        ))}
      </div>

      {/* Price Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', backgroundColor: T.bg, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ color: T.white, fontWeight: 800, fontSize: 15 }}>{symbol.replace('USDT', '')}/USDT</span>
        <span style={{ color: T.green, fontWeight: 800, fontSize: 18 }}>${currentPrice.toLocaleString()}</span>
        <span style={{ color: parseFloat(liveData.change) >= 0 ? T.green : T.red, fontSize: 12 }}>{parseFloat(liveData.change) >= 0 ? '+' : ''}{liveData.change || '0.00'}%</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowOverlay(!showOverlay)} style={{ background: showOverlay ? 'rgba(240,185,11,0.15)' : T.card2, border: `1px solid ${showOverlay ? T.yellow : T.border}`, color: showOverlay ? T.yellow : T.text, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
            {showOverlay ? '📊 Overlay ON' : '📊 Overlay OFF'}
          </button>
        </div>
      </div>

      {/* Main Layout */}
      {isMobile ? (
        // MOBILE: Full screen chart + floating button + slide-up panel
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', height: '100%' }}>
            <iframe
              key={symbol}
              src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE%3A${symbol}&interval=15&theme=dark&style=1&locale=en&toolbar_bg=%231e2329&hide_side_toolbar=0&allow_symbol_change=0`}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title="Chart"
            />
            {showOverlay && (
              <ChartOverlay
                currentPrice={currentPrice}
                tp={tp} sl={sl} side={side}
                onTpChange={setTp} onSlChange={setSl}
              />
            )}
          </div>

          {/* Floating Trade Button */}
          {!showOrderPanel && (
            <button
              onClick={() => setShowOrderPanel(true)}
              style={{
                position: 'absolute', bottom: 20, right: 16,
                backgroundColor: side === 'BUY' ? T.green : T.red,
                color: '#fff', border: 'none', borderRadius: 28,
                padding: '14px 24px', fontWeight: 800, fontSize: 15,
                cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                zIndex: 50, display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              {side === 'BUY' ? '▲ Long' : '▼ Short'} {symbol.replace('USDT', '')}
            </button>
          )}

          {/* Slide-up Order Panel */}
          {showOrderPanel && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backgroundColor: T.card, borderRadius: '16px 16px 0 0',
              border: `1px solid ${T.border}`, zIndex: 100,
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.6)'
            }}>
              {/* Handle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 8px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, margin: '0 auto' }} />
                <button onClick={() => setShowOrderPanel(false)} style={{ background: 'none', border: 'none', color: T.text, fontSize: 20, cursor: 'pointer', position: 'absolute', right: 16, top: 10 }}>✕</button>
              </div>
              <div style={{ padding: '12px 16px 20px' }}>
                <OrderForm />
              </div>
            </div>
          )}
        </div>
      ) : (
        // DESKTOP: Chart + Side Panel
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 0, maxWidth: 1400, margin: '0 auto', width: '100%', padding: 12, gap: 12, boxSizing: 'border-box' }}>
          <Card style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <iframe
                key={symbol}
                src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE%3A${symbol}&interval=15&theme=dark&style=1&locale=en&toolbar_bg=%231e2329&hide_side_toolbar=0&allow_symbol_change=0`}
                style={{ width: '100%', height: 480, border: 'none', display: 'block' }}
                title="Chart"
              />
              {showOverlay && (
                <ChartOverlay
                  currentPrice={currentPrice}
                  tp={tp} sl={sl} side={side}
                  onTpChange={setTp} onSlChange={setSl}
                />
              )}
            </div>
          </Card>

          <Card style={{ padding: '14px 14px', overflowY: 'auto', maxHeight: '480px' }}>
            <OrderForm />
          </Card>
        </div>
      )}
    </div>
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
        <h1 style={{ color: T.white, fontSize: 'clamp(26px, 8vw, 42px)', fontWeight: 900, marginBottom: 12 }}>
          THE ATHARVA <span style={{ color: T.yellow }}>CAPITAL</span>
        </h1>
        <p style={{ color: T.text, fontSize: 17, maxWidth: 500, margin: '0 auto 28px' }}>Paper Trade Crypto with $0 risk. Master the markets before going live.</p>
        {!user && (
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" style={{ backgroundColor: T.yellow, color: '#000', padding: '13px 32px', borderRadius: 8, fontWeight: 'bold', textDecoration: 'none', fontSize: 16 }}>Start Trading Free</Link>
            <Link to="/markets" style={{ backgroundColor: T.card, color: T.white, padding: '13px 32px', borderRadius: 8, fontWeight: 'bold', textDecoration: 'none', fontSize: 16, border: `1px solid ${T.border}` }}>View Markets</Link>
          </div>
        )}
      </div>
      <h2 style={{ color: T.white, fontSize: 18, marginBottom: 14 }}>🔴 Live Market</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 40 }}>
        {topCoins.map((sym) => {
          const d = prices[sym];
          const chg = d ? parseFloat(d.change) : 0;
          return (
            <Link key={sym} to={`/trade?symbol=${sym}`} style={{ textDecoration: 'none' }}>
              <Card style={{ cursor: 'pointer', borderLeft: `3px solid ${chg >= 0 ? T.green : T.red}`, padding: 14 }}>
                <div style={{ color: T.white, fontWeight: 700, fontSize: 14 }}>{sym.replace('USDT', '')}</div>
                <div style={{ color: T.white, fontSize: 17, fontWeight: 800, margin: '5px 0' }}>${d ? parseFloat(d.price).toLocaleString() : '—'}</div>
                <div style={{ color: chg >= 0 ? T.green : T.red, fontSize: 12, fontWeight: 600 }}>{chg >= 0 ? '+' : ''}{chg}%</div>
              </Card>
            </Link>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {[
          ['💰', '$10,000 Virtual Balance', 'Start trading with virtual USDT instantly.'],
          ['📊', 'Live TradingView Charts', 'Pro charts with all indicators.'],
          ['⚡', 'Real-time Binance Prices', 'Prices streamed live from Binance.'],
          ['🎯', 'Visual TP/SL Lines', 'Drag-and-drop TP/SL directly on the chart.']
        ].map(([icon, title, desc]) => (
          <Card key={title} style={{ padding: 16 }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
            <div style={{ color: T.white, fontWeight: 700, marginBottom: 5, fontSize: 14 }}>{title}</div>
            <div style={{ color: T.text, fontSize: 12 }}>{desc}</div>
          </Card>
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
  const coins = Object.entries(prices).filter(([sym]) => sym.includes(search.toUpperCase())).sort((a, b) => parseFloat(b[1].price) - parseFloat(a[1].price)).slice(0, 60);

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
      <h2 style={{ color: T.white, marginBottom: 14 }}>Markets</h2>
      <Input placeholder="Search e.g. BTC, ETH..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320, marginBottom: 18 }} />
      <div style={{ backgroundColor: T.card, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 0.5fr', padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
          {['Pair', 'Price', '24h Change', 'Action', ''].map((h) => <span key={h} style={{ color: T.text, fontSize: 11, fontWeight: 600 }}>{h}</span>)}
        </div>
        {coins.length === 0 ? <div style={{ color: T.text, padding: 40, textAlign: 'center' }}>Loading prices...</div>
          : coins.map(([sym, d]) => {
            const chg = parseFloat(d.change);
            const isWatched = userData?.watchlist?.includes(sym);
            return (
              <div key={sym} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 0.5fr', padding: '12px 16px', borderBottom: `1px solid ${T.border}`, alignItems: 'center' }}>
                <span style={{ color: T.white, fontWeight: 700, fontSize: 13 }}>{sym.replace('USDT', '')}<span style={{ color: T.text, fontWeight: 400 }}>/USDT</span></span>
                <span style={{ color: T.white, fontWeight: 600, fontSize: 13 }}>${parseFloat(d.price).toLocaleString()}</span>
                <span style={{ color: chg >= 0 ? T.green : T.red, backgroundColor: chg >= 0 ? 'rgba(2,192,118,0.1)' : 'rgba(246,70,93,0.1)', padding: '2px 8px', borderRadius: 4, fontSize: 12, display: 'inline-block', fontWeight: 600, width: 'fit-content' }}>{chg >= 0 ? '+' : ''}{chg}%</span>
                <Link to={`/trade?symbol=${sym}`} style={{ color: T.yellow, textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>Trade →</Link>
                <button onClick={() => toggleWatchlist(sym)} style={{ background: 'none', border: 'none', color: isWatched ? T.yellow : T.text, cursor: 'pointer', fontSize: 16, padding: 0 }}>{isWatched ? '★' : '☆'}</button>
              </div>
            );
          })}
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
    const cp = parseFloat(prices[pos.symbol]?.price || pos.entryPrice);
    const pd = pos.type === 'LONG' ? cp - pos.entryPrice : pos.entryPrice - cp;
    const pnl = (pd / pos.entryPrice) * pos.totalSize;
    const roe = (pnl / pos.margin) * 100;
    totalUnrealizedPnL += pnl;
    return { ...pos, currentPrice: cp, pnl, roe };
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
        const currentPositions = userDoc.data().positions || [];
        const newPositions = currentPositions.filter((_, i) => i !== index);
        const closedPositions = userDoc.data().closedPositions || [];
        transaction.update(userRef, { virtualBalance: increment(pos.margin + finalPnl), positions: newPositions, closedPositions: [...closedPositions, closedPosition] });
      });
      await refreshUser();
      setCloseMsg({ t: finalPnl >= 0 ? 'success' : 'error', m: `Position closed. PnL: ${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)} (fee deducted)` });
    } catch (e) { setCloseMsg({ t: 'error', m: e.message }); }
  };

  const equityData = (userData?.closedPositions || []).map((pos, idx) => ({ name: `#${idx + 1}`, pnl: parseFloat(pos.realizedPnl.toFixed(2)) }));

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ color: T.white, marginBottom: 18 }}>Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Card style={{ padding: 16 }}><div style={{ color: T.text, fontSize: 11, marginBottom: 5 }}>Virtual Balance</div><div style={{ color: T.white, fontSize: 22, fontWeight: 800 }}>${parseFloat(userData?.virtualBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></Card>
        <Card style={{ padding: 16 }}><div style={{ color: T.text, fontSize: 11, marginBottom: 5 }}>Unrealized PnL</div><div style={{ color: totalUnrealizedPnL >= 0 ? T.green : T.red, fontSize: 20, fontWeight: 800 }}>{totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}</div></Card>
        <Card style={{ padding: 16 }}><div style={{ color: T.text, fontSize: 11, marginBottom: 5 }}>Open Positions</div><div style={{ color: T.white, fontSize: 22, fontWeight: 800 }}>{positions.length}</div></Card>
        <Card style={{ padding: 16 }}><div style={{ color: T.text, fontSize: 11, marginBottom: 5 }}>Total Trades</div><div style={{ color: T.white, fontSize: 22, fontWeight: 800 }}>{userData?.closedPositions?.length || 0}</div></Card>
      </div>

      {equityData.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <h3 style={{ color: T.white, marginTop: 0, marginBottom: 14, fontSize: 15 }}>Closed PnL History</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={equityData}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="name" stroke={T.text} tick={{ fontSize: 11 }} />
              <YAxis stroke={T.text} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: T.card, border: 'none', fontSize: 12 }} labelStyle={{ color: T.white }} />
              <Line type="monotone" dataKey="pnl" stroke={T.green} strokeWidth={2} dot={{ r: 3, fill: T.green }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {closeMsg && <div style={{ backgroundColor: closeMsg.t === 'success' ? 'rgba(2,192,118,0.15)' : 'rgba(246,70,93,0.15)', color: closeMsg.t === 'success' ? T.green : T.red, padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{closeMsg.m}</div>}

      <h3 style={{ color: T.white, marginBottom: 10, fontSize: 15 }}>Open Positions</h3>
      {enriched.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 36 }}>
          <div style={{ color: T.text, marginBottom: 14, fontSize: 14 }}>No open positions. Start trading!</div>
          <Link to="/trade" style={{ backgroundColor: T.yellow, color: '#000', padding: '10px 24px', borderRadius: 6, textDecoration: 'none', fontWeight: 'bold', fontSize: 13 }}>Open a Trade</Link>
        </Card>
      ) : enriched.map((pos, i) => (
        <Card key={i} style={{ marginBottom: 10, borderLeft: `3px solid ${pos.type === 'LONG' ? T.green : T.red}`, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <span style={{ color: pos.type === 'LONG' ? T.green : T.red, fontWeight: 700, fontSize: 15 }}>{pos.symbol} {pos.type} {pos.leverage}x</span>
              {(pos.tp || pos.sl) && (
                <span style={{ marginLeft: 10, fontSize: 11, color: T.text }}>
                  {pos.tp && <span style={{ color: T.green }}>TP ${pos.tp.toFixed(2)} </span>}
                  {pos.sl && <span style={{ color: T.red }}>SL ${pos.sl.toFixed(2)}</span>}
                </span>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '6px 16px', marginTop: 10 }}>
                {[['Entry', `$${pos.entryPrice.toFixed(2)}`], ['Mark', `$${pos.currentPrice.toFixed(2)}`], ['Size', `$${pos.totalSize.toFixed(2)}`], ['Margin', `$${pos.margin.toFixed(2)}`], ['PnL', `${pos.pnl >= 0 ? '+' : ''}$${pos.pnl.toFixed(2)}`], ['ROE', `${pos.roe >= 0 ? '+' : ''}${pos.roe.toFixed(2)}%`]].map(([l, v]) => (
                  <div key={l}><div style={{ color: T.text, fontSize: 10 }}>{l}</div><div style={{ color: (l === 'PnL' || l === 'ROE') ? (pos.pnl >= 0 ? T.green : T.red) : T.white, fontSize: 13, fontWeight: 600 }}>{v}</div></div>
                ))}
              </div>
            </div>
            <button onClick={() => handleClose(i)} style={{ backgroundColor: T.card2, border: `1px solid ${T.border}`, color: T.white, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>Close</button>
          </div>
        </Card>
      ))}

      <h3 style={{ color: T.white, marginTop: 28, marginBottom: 10, fontSize: 15 }}>Order History</h3>
      {userData?.closedPositions?.length > 0 ? userData.closedPositions.slice().reverse().map((pos, idx) => (
        <Card key={idx} style={{ marginBottom: 8, opacity: 0.9, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span><span style={{ color: pos.type === 'LONG' ? T.green : T.red, fontWeight: 600, fontSize: 13 }}>{pos.symbol} {pos.type}</span> <span style={{ color: T.text, fontSize: 11 }}>{new Date(pos.closedAt).toLocaleString()}</span></span>
            <span style={{ color: pos.realizedPnl >= 0 ? T.green : T.red, fontWeight: 700, fontSize: 13 }}>{pos.realizedPnl >= 0 ? '+' : ''}${pos.realizedPnl.toFixed(2)}</span>
          </div>
          <div style={{ color: T.text, fontSize: 11, marginTop: 3 }}>Entry ${pos.entryPrice.toFixed(2)} → Exit ${pos.exitPrice.toFixed(2)} | Size ${pos.totalSize.toFixed(2)} | {pos.leverage}x</div>
        </Card>
      )) : <Card style={{ textAlign: 'center', padding: 28, color: T.text, fontSize: 13 }}>No closed trades yet.</Card>}
    </div>
  );
};

// -------------------- Wallet (Top-up removed) --------------------
const WalletScreen = () => {
  const { userData } = useContext(AuthContext);

  return (
    <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ color: T.white, marginBottom: 22 }}>Wallet</h2>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ color: T.text, fontSize: 12, marginBottom: 5 }}>Total Equity (USDT)</div>
        <div style={{ color: T.white, fontSize: 34, fontWeight: 900 }}>${parseFloat(userData?.virtualBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div style={{ color: T.text, fontSize: 11, marginTop: 6 }}>Paper trading account • No real funds</div>
      </Card>
      <Card>
        <div style={{ color: T.white, fontWeight: 700, marginBottom: 14, fontSize: 15 }}>Assets</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#26A17B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>₮</div>
            <div><div style={{ color: T.white, fontWeight: 600 }}>USDT</div><div style={{ color: T.text, fontSize: 11 }}>Tether</div></div>
          </div>
          <div style={{ textAlign: 'right' }}><div style={{ color: T.white, fontWeight: 700 }}>{parseFloat(userData?.virtualBalance || 0).toFixed(2)}</div><div style={{ color: T.text, fontSize: 11 }}>Available</div></div>
        </div>
        <div style={{ color: T.text, textAlign: 'center', padding: '16px 0', fontSize: 12 }}>All funds are in USDT. Start trading to open positions.</div>
        <Link to="/trade" style={{ display: 'block', textAlign: 'center', backgroundColor: T.yellow, color: '#000', padding: '10px 0', borderRadius: 6, fontWeight: 700, textDecoration: 'none', fontSize: 13, marginTop: 8 }}>Start Trading →</Link>
      </Card>
    </div>
  );
};

// -------------------- Leaderboard --------------------
const LeaderboardScreen = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('virtualBalance', 'desc'), limit(20));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setUsers(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  return (
    <div style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ color: T.white, marginBottom: 18 }}>🏆 Leaderboard</h2>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '0.5fr 2fr 1.5fr', padding: '12px 18px', borderBottom: `1px solid ${T.border}`, backgroundColor: T.card2 }}>
          <span style={{ color: T.text, fontWeight: 600, fontSize: 12 }}>#</span>
          <span style={{ color: T.text, fontWeight: 600, fontSize: 12 }}>Trader</span>
          <span style={{ color: T.text, fontWeight: 600, textAlign: 'right', fontSize: 12 }}>Balance</span>
        </div>
        {loading ? <div style={{ color: T.text, padding: 40, textAlign: 'center' }}>Loading...</div>
          : users.map((u, idx) => (
            <div key={u.uid} style={{ display: 'grid', gridTemplateColumns: '0.5fr 2fr 1.5fr', padding: '12px 18px', borderBottom: `1px solid ${T.border}`, alignItems: 'center' }}>
              <span style={{ color: idx < 3 ? T.yellow : T.white, fontWeight: 700, fontSize: idx < 3 ? 16 : 14 }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</span>
              <span style={{ color: T.white, fontSize: 13 }}>{u.name || 'Anonymous'}</span>
              <span style={{ color: T.green, fontWeight: 700, textAlign: 'right', fontSize: 13 }}>${u.virtualBalance?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
      </Card>
    </div>
  );
};

// -------------------- Auth Screens --------------------
const LoginScreen = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return setError('Enter email and password.');
    setLoading(true); setError('');
    try { await login(email, password); navigate('/dashboard'); }
    catch (e) { setError(e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' ? 'Invalid email or password.' : e.message); }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ color: T.yellow, fontWeight: 900, fontSize: 20, textAlign: 'center', marginBottom: 6 }}>ATHARVA CAPITAL</div>
        <div style={{ color: T.text, textAlign: 'center', marginBottom: 24, fontSize: 13 }}>Welcome back</div>
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Email</label>
        <Input placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={{ marginBottom: 12 }} />
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Password</label>
        <Input placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} type="password" style={{ marginBottom: 16 }} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
        {error && <div style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <Btn onClick={handleLogin} disabled={loading}>{loading ? 'Logging in...' : 'Login'}</Btn>
        <div style={{ textAlign: 'center', marginTop: 16, color: T.text, fontSize: 13 }}>New here? <Link to="/signup" style={{ color: T.yellow, fontWeight: 600, textDecoration: 'none' }}>Create Account</Link></div>
      </Card>
    </div>
  );
};

const SignupScreen = () => {
  const { signUp } = useContext(AuthContext);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password) return setError('Fill in all fields.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setLoading(true); setError('');
    try { await signUp(email, password, name); navigate('/dashboard'); }
    catch (e) { setError(e.code === 'auth/email-already-in-use' ? 'This email is already registered.' : e.message); }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ color: T.yellow, fontWeight: 900, fontSize: 20, textAlign: 'center', marginBottom: 6 }}>ATHARVA CAPITAL</div>
        <div style={{ color: T.text, textAlign: 'center', marginBottom: 24, fontSize: 13 }}>Get $10,000 virtual USDT to trade with</div>
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Your Name</label>
        <Input placeholder="Atharva" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} />
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Email</label>
        <Input placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={{ marginBottom: 12 }} />
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Password</label>
        <Input placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} type="password" style={{ marginBottom: 16 }} onKeyDown={(e) => e.key === 'Enter' && handleSignup()} />
        {error && <div style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <Btn onClick={handleSignup} disabled={loading}>{loading ? 'Creating account...' : 'Create Account & Get $10,000'}</Btn>
        <div style={{ textAlign: 'center', marginTop: 16, color: T.text, fontSize: 13 }}>Already registered? <Link to="/login" style={{ color: T.yellow, fontWeight: 600, textDecoration: 'none' }}>Login</Link></div>
      </Card>
    </div>
  );
};

// -------------------- App --------------------
export default function App() {
  return (
    <AuthProvider>
      <PriceProvider>
        <Router>
          <div style={{ backgroundColor: T.bg, minHeight: '100vh', color: T.white, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
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
