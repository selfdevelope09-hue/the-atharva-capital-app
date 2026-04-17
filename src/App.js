import React, { useState, createContext, useContext, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';

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
  bg: '#0b0e11', card: '#1e2329', card2: '#2b3139',
  yellow: '#f0b90b', green: '#02c076', red: '#f6465d',
  text: '#848e9c', white: '#ffffff', border: '#2b2f36'
};

const AuthContext = createContext();
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (uid) => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) { setUserData(snap.data()); return snap.data(); }
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
    const data = { uid: res.user.uid, email, name: name || 'Trader', virtualBalance: 10000, positions: [], portfolio: [], createdAt: new Date().toISOString() };
    await setDoc(doc(db, 'users', res.user.uid), data);
    setUserData(data);
  };
  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);
  const refreshUser = async () => { if (user) return await fetchUserData(user.uid); };

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
        const data = JSON.parse(e.data);
        const updates = {};
        data.forEach(coin => {
          if (coin.s.endsWith('USDT')) updates[coin.s] = { price: parseFloat(coin.c).toFixed(2), close: parseFloat(coin.c), open: parseFloat(coin.o), change: (((parseFloat(coin.c) - parseFloat(coin.o)) / parseFloat(coin.o)) * 100).toFixed(2) };
        });
        setPrices(prev => ({ ...prev, ...updates }));
      };
      ws.onclose = () => setTimeout(connect, 3000);
    };
    connect();
    return () => ws && ws.close();
  }, []);
  return <PriceContext.Provider value={prices}>{children}</PriceContext.Provider>;
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div style={{ color: T.yellow, textAlign: 'center', marginTop: 80, fontSize: 18 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

const Input = ({ style, ...props }) => (
  <input style={{ backgroundColor: T.card2, border: `1px solid ${T.border}`, color: T.white, padding: '12px 14px', borderRadius: 6, width: '100%', fontSize: 14, outline: 'none', boxSizing: 'border-box', ...style }} {...props} />
);
const Btn = ({ children, style, color, ...props }) => (
  <button style={{ backgroundColor: color || T.yellow, color: color ? T.white : '#000', border: 'none', padding: '13px 20px', borderRadius: 6, fontWeight: 'bold', fontSize: 15, cursor: 'pointer', width: '100%', opacity: props.disabled ? 0.6 : 1, ...style }} {...props}>{children}</button>
);
const Card = ({ children, style }) => (
  <div style={{ backgroundColor: T.card, borderRadius: 12, padding: 20, ...style }}>{children}</div>
);

const Navbar = () => {
  const { user, userData, logout } = useContext(AuthContext);
  return (
    <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', height: 56, backgroundColor: T.card, borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 100 }}>
      <Link to="/" style={{ color: T.yellow, fontWeight: 'bold', textDecoration: 'none', fontSize: 17, letterSpacing: 1 }}>⚡ ATHARVA CAPITAL</Link>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        {[['/', 'Home'], ['/markets', 'Markets'], ['/trade', 'Trade'], ['/dashboard', 'Dashboard'], ['/wallet', 'Wallet']].map(([p, l]) => (
          <Link key={p} to={p} style={{ color: T.text, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{l}</Link>
        ))}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ color: T.yellow, fontSize: 13, fontWeight: 600 }}>${parseFloat(userData?.virtualBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <button onClick={logout} style={{ background: 'none', border: `1px solid ${T.red}`, color: T.red, padding: '5px 14px', borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>Logout</button>
          </div>
        ) : (
          <Link to="/login" style={{ backgroundColor: T.yellow, color: '#000', padding: '7px 18px', borderRadius: 5, textDecoration: 'none', fontWeight: 'bold', fontSize: 13 }}>Login</Link>
        )}
      </div>
    </nav>
  );
};

const HomeScreen = () => {
  const prices = useContext(PriceContext);
  const { user } = useContext(AuthContext);
  const topCoins = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
  return (
    <div style={{ padding: '40px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 60 }}>
        <h1 style={{ color: T.white, fontSize: 42, fontWeight: 900, marginBottom: 12 }}>THE ATHARVA <span style={{ color: T.yellow }}>CAPITAL</span></h1>
        <p style={{ color: T.text, fontSize: 18, maxWidth: 500, margin: '0 auto 28px' }}>Paper Trade Crypto with $0 risk. Master the markets before going live.</p>
        {!user && (
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            <Link to="/signup" style={{ backgroundColor: T.yellow, color: '#000', padding: '13px 32px', borderRadius: 8, fontWeight: 'bold', textDecoration: 'none', fontSize: 16 }}>Start Trading Free</Link>
            <Link to="/markets" style={{ backgroundColor: T.card, color: T.white, padding: '13px 32px', borderRadius: 8, fontWeight: 'bold', textDecoration: 'none', fontSize: 16, border: `1px solid ${T.border}` }}>View Markets</Link>
          </div>
        )}
      </div>
      <h2 style={{ color: T.white, fontSize: 20, marginBottom: 16 }}>🔴 Live Market</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 40 }}>
        {topCoins.map(sym => {
          const d = prices[sym]; const chg = d ? parseFloat(d.change) : 0;
          return (
            <Link key={sym} to={`/trade?symbol=${sym}`} style={{ textDecoration: 'none' }}>
              <Card style={{ cursor: 'pointer', borderLeft: `3px solid ${chg >= 0 ? T.green : T.red}` }}>
                <div style={{ color: T.white, fontWeight: 700, fontSize: 15 }}>{sym.replace('USDT', '')}</div>
                <div style={{ color: T.white, fontSize: 18, fontWeight: 800, margin: '6px 0' }}>${d ? parseFloat(d.price).toLocaleString() : '—'}</div>
                <div style={{ color: chg >= 0 ? T.green : T.red, fontSize: 13, fontWeight: 600 }}>{chg >= 0 ? '+' : ''}{chg}%</div>
              </Card>
            </Link>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {[['💰', '$10,000 Virtual Balance', 'Start trading with virtual USDT instantly.'], ['📊', 'Live TradingView Charts', 'Pro charts with all indicators.'], ['⚡', 'Real-time Binance Prices', 'Prices streamed live from Binance.'], ['🔒', 'Secure Firebase Backend', 'Your account safely stored in Firebase.']].map(([icon, title, desc]) => (
          <Card key={title}><div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div><div style={{ color: T.white, fontWeight: 700, marginBottom: 6 }}>{title}</div><div style={{ color: T.text, fontSize: 13 }}>{desc}</div></Card>
        ))}
      </div>
    </div>
  );
};

const MarketsScreen = () => {
  const prices = useContext(PriceContext);
  const [search, setSearch] = useState('');
  const coins = Object.entries(prices).filter(([sym]) => sym.includes(search.toUpperCase())).sort((a, b) => parseFloat(b[1].price) - parseFloat(a[1].price)).slice(0, 60);
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ color: T.white, marginBottom: 16 }}>Markets</h2>
      <Input placeholder="Search e.g. BTC, ETH..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320, marginBottom: 20 }} />
      <div style={{ backgroundColor: T.card, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr', padding: '12px 20px', borderBottom: `1px solid ${T.border}` }}>
          {['Pair', 'Price', '24h Change', 'Action'].map(h => <span key={h} style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{h}</span>)}
        </div>
        {coins.length === 0 ? <div style={{ color: T.text, padding: 40, textAlign: 'center' }}>Loading prices...</div>
          : coins.map(([sym, d]) => {
            const chg = parseFloat(d.change);
            return (
              <div key={sym} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr', padding: '14px 20px', borderBottom: `1px solid ${T.border}`, alignItems: 'center' }}>
                <span style={{ color: T.white, fontWeight: 700 }}>{sym.replace('USDT', '')}<span style={{ color: T.text, fontWeight: 400 }}>/USDT</span></span>
                <span style={{ color: T.white, fontWeight: 600 }}>${parseFloat(d.price).toLocaleString()}</span>
                <span style={{ color: chg >= 0 ? T.green : T.red, backgroundColor: chg >= 0 ? 'rgba(2,192,118,0.1)' : 'rgba(246,70,93,0.1)', padding: '3px 10px', borderRadius: 4, fontSize: 13, display: 'inline-block', fontWeight: 600 }}>{chg >= 0 ? '+' : ''}{chg}%</span>
                <Link to={`/trade?symbol=${sym}`} style={{ color: T.yellow, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Trade →</Link>
              </div>
            );
          })}
      </div>
    </div>
  );
};

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
  const [tp, setTp] = useState(''); const [sl, setSl] = useState('');
  const [msg, setMsg] = useState(null); const [loading, setLoading] = useState(false);
  const liveData = prices[symbol] || {};
  const currentPrice = parseFloat(liveData.price || 0);
  const execPrice = orderType === 'Market' ? currentPrice : parseFloat(limitPrice || currentPrice);
  const popularPairs = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];

  const handleTrade = async () => {
    if (!user) return navigate('/login');
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return setMsg({ t: 'error', m: 'Enter a valid amount.' });
    const amt = parseFloat(amount); const marginReq = amt / leverage;
    if (marginReq > (userData?.virtualBalance || 0)) return setMsg({ t: 'error', m: `Insufficient balance. Need $${marginReq.toFixed(2)} margin.` });
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { virtualBalance: increment(-marginReq), positions: arrayUnion({ symbol, type: side === 'BUY' ? 'LONG' : 'SHORT', entryPrice: execPrice, leverage, margin: marginReq, totalSize: amt, tp: tp ? parseFloat(tp) : null, sl: sl ? parseFloat(sl) : null, status: 'OPEN', time: new Date().toISOString() }) });
      await refreshUser();
      setMsg({ t: 'success', m: `✅ ${side === 'BUY' ? 'LONG' : 'SHORT'} ${symbol} at $${execPrice.toFixed(2)}` });
      setAmount(''); setTp(''); setSl('');
    } catch (e) { setMsg({ t: 'error', m: e.message }); }
    setLoading(false);
  };

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {popularPairs.map(s => (
          <button key={s} onClick={() => setSymbol(s)} style={{ backgroundColor: symbol === s ? T.yellow : T.card2, color: symbol === s ? '#000' : T.white, border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: symbol === s ? 700 : 400, fontSize: 13 }}>{s.replace('USDT', '')}/USDT</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 20, alignItems: 'center' }}>
            <span style={{ color: T.white, fontWeight: 700, fontSize: 16 }}>{symbol.replace('USDT', '')}/USDT</span>
            <span style={{ color: T.green, fontWeight: 700, fontSize: 18 }}>${currentPrice.toLocaleString()}</span>
            <span style={{ color: parseFloat(liveData.change) >= 0 ? T.green : T.red, fontSize: 13 }}>{parseFloat(liveData.change) >= 0 ? '+' : ''}{liveData.change || '0.00'}%</span>
          </div>
          <iframe key={symbol} src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE%3A${symbol}&interval=15&theme=dark&style=1&locale=en&toolbar_bg=%231e2329&hide_side_toolbar=0&allow_symbol_change=0`} style={{ width: '100%', height: 420, border: 'none' }} title="Chart" />
        </Card>
        <Card>
          <div style={{ display: 'flex', backgroundColor: T.card2, borderRadius: 6, marginBottom: 14 }}>
            {['Market', 'Limit'].map(t => <button key={t} onClick={() => setOrderType(t)} style={{ flex: 1, padding: 8, border: 'none', borderRadius: 6, cursor: 'pointer', backgroundColor: orderType === t ? T.yellow : 'transparent', color: orderType === t ? '#000' : T.text, fontWeight: 600, fontSize: 13 }}>{t}</button>)}
          </div>
          <div style={{ display: 'flex', backgroundColor: T.card2, borderRadius: 6, marginBottom: 14 }}>
            <button onClick={() => setSide('BUY')} style={{ flex: 1, padding: 10, border: 'none', borderRadius: 6, cursor: 'pointer', backgroundColor: side === 'BUY' ? T.green : 'transparent', color: T.white, fontWeight: 700, fontSize: 14 }}>Buy / Long</button>
            <button onClick={() => setSide('SELL')} style={{ flex: 1, padding: 10, border: 'none', borderRadius: 6, cursor: 'pointer', backgroundColor: side === 'SELL' ? T.red : 'transparent', color: T.white, fontWeight: 700, fontSize: 14 }}>Sell / Short</button>
          </div>
          {userData && <div style={{ color: T.text, fontSize: 12, marginBottom: 10 }}>Available: <span style={{ color: T.white }}>${parseFloat(userData.virtualBalance || 0).toFixed(2)} USDT</span></div>}
          {orderType === 'Limit' && <div style={{ marginBottom: 10 }}><label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Limit Price</label><Input placeholder={currentPrice.toFixed(2)} value={limitPrice} onChange={e => setLimitPrice(e.target.value)} type="number" /></div>}
          <div style={{ marginBottom: 10 }}><label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Amount (USDT)</label><Input placeholder="e.g. 100" value={amount} onChange={e => setAmount(e.target.value)} type="number" /></div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 6 }}>Leverage: <span style={{ color: T.yellow, fontWeight: 700 }}>{leverage}x</span></label>
            <input type="range" min={1} max={125} value={leverage} onChange={e => setLeverage(parseInt(e.target.value))} style={{ width: '100%', accentColor: T.yellow }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {[1, 5, 10, 25, 50, 100, 125].map(v => <button key={v} onClick={() => setLeverage(v)} style={{ background: 'none', border: 'none', color: leverage === v ? T.yellow : T.text, cursor: 'pointer', fontSize: 11, fontWeight: leverage === v ? 700 : 400 }}>{v}x</button>)}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div><label style={{ color: T.text, fontSize: 11, display: 'block', marginBottom: 4 }}>Take Profit</label><Input placeholder="Optional" value={tp} onChange={e => setTp(e.target.value)} type="number" /></div>
            <div><label style={{ color: T.text, fontSize: 11, display: 'block', marginBottom: 4 }}>Stop Loss</label><Input placeholder="Optional" value={sl} onChange={e => setSl(e.target.value)} type="number" /></div>
          </div>
          {amount && !isNaN(amount) && parseFloat(amount) > 0 && (
            <div style={{ backgroundColor: T.card2, borderRadius: 6, padding: '10px 12px', marginBottom: 12, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: T.text }}>Position Size</span><span style={{ color: T.white }}>${parseFloat(amount).toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: T.text }}>Margin Required</span><span style={{ color: T.yellow }}>${(parseFloat(amount) / leverage).toFixed(2)}</span></div>
            </div>
          )}
          {msg && <div style={{ backgroundColor: msg.t === 'success' ? 'rgba(2,192,118,0.15)' : 'rgba(246,70,93,0.15)', color: msg.t === 'success' ? T.green : T.red, padding: '10px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{msg.m}</div>}
          {user ? <Btn color={side === 'BUY' ? T.green : T.red} onClick={handleTrade} disabled={loading}>{loading ? 'Opening...' : `${side === 'BUY' ? 'Buy / Long' : 'Sell / Short'} ${symbol.replace('USDT', '')}`}</Btn>
            : <Link to="/login" style={{ display: 'block', textAlign: 'center', backgroundColor: T.yellow, color: '#000', padding: 13, borderRadius: 6, fontWeight: 'bold', textDecoration: 'none' }}>Login to Trade</Link>}
        </Card>
      </div>
    </div>
  );
};

const DashboardScreen = () => {
  const { user, userData, refreshUser } = useContext(AuthContext);
  const prices = useContext(PriceContext);
  const [closeMsg, setCloseMsg] = useState(null);

  const positions = userData?.positions || [];
  let totalPnL = 0;
  const enriched = positions.map(pos => {
    const cp = parseFloat(prices[pos.symbol]?.price || pos.entryPrice);
    const pd = pos.type === 'LONG' ? cp - pos.entryPrice : pos.entryPrice - cp;
    const pnl = (pd / pos.entryPrice) * pos.totalSize;
    const roe = (pnl / pos.margin) * 100;
    totalPnL += pnl;
    return { ...pos, currentPrice: cp, pnl, roe };
  });

  const handleClose = async (index) => {
    const pos = enriched[index];
    const fee = pos.totalSize * 0.0005;
    const finalPnl = pos.pnl - fee;
    try {
      await updateDoc(doc(db, 'users', user.uid), { virtualBalance: increment(pos.margin + finalPnl), positions: userData.positions.filter((_, i) => i !== index) });
      await refreshUser();
      setCloseMsg({ t: finalPnl >= 0 ? 'success' : 'error', m: `Position closed. PnL: ${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)} (0.05% fee deducted)` });
    } catch (e) { setCloseMsg({ t: 'error', m: e.message }); }
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ color: T.white, marginBottom: 20 }}>Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <Card><div style={{ color: T.text, fontSize: 12, marginBottom: 6 }}>Virtual Balance</div><div style={{ color: T.white, fontSize: 24, fontWeight: 800 }}>${parseFloat(userData?.virtualBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></Card>
        <Card><div style={{ color: T.text, fontSize: 12, marginBottom: 6 }}>Unrealized PnL</div><div style={{ color: totalPnL >= 0 ? T.green : T.red, fontSize: 22, fontWeight: 800 }}>{totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}</div></Card>
        <Card><div style={{ color: T.text, fontSize: 12, marginBottom: 6 }}>Open Positions</div><div style={{ color: T.white, fontSize: 24, fontWeight: 800 }}>{positions.length}</div></Card>
      </div>
      {closeMsg && <div style={{ backgroundColor: closeMsg.t === 'success' ? 'rgba(2,192,118,0.15)' : 'rgba(246,70,93,0.15)', color: closeMsg.t === 'success' ? T.green : T.red, padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{closeMsg.m}</div>}
      <h3 style={{ color: T.white, marginBottom: 12 }}>Open Positions</h3>
      {enriched.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ color: T.text, marginBottom: 14 }}>No open positions. Start trading!</div>
          <Link to="/trade" style={{ backgroundColor: T.yellow, color: '#000', padding: '10px 24px', borderRadius: 6, textDecoration: 'none', fontWeight: 'bold' }}>Open a Trade</Link>
        </Card>
      ) : enriched.map((pos, i) => (
        <Card key={i} style={{ marginBottom: 12, borderLeft: `3px solid ${pos.type === 'LONG' ? T.green : T.red}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <span style={{ color: pos.type === 'LONG' ? T.green : T.red, fontWeight: 700, fontSize: 16 }}>{pos.symbol} {pos.type} {pos.leverage}x</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 20px', marginTop: 12 }}>
                {[['Entry', `$${pos.entryPrice.toFixed(2)}`], ['Mark', `$${pos.currentPrice.toFixed(2)}`], ['Size', `$${pos.totalSize.toFixed(2)}`], ['Margin', `$${pos.margin.toFixed(2)}`], ['PnL', `${pos.pnl >= 0 ? '+' : ''}$${pos.pnl.toFixed(2)}`], ['ROE', `${pos.roe >= 0 ? '+' : ''}${pos.roe.toFixed(2)}%`]].map(([l, v]) => (
                  <div key={l}><div style={{ color: T.text, fontSize: 11 }}>{l}</div><div style={{ color: (l === 'PnL' || l === 'ROE') ? (pos.pnl >= 0 ? T.green : T.red) : T.white, fontSize: 14, fontWeight: 600 }}>{v}</div></div>
                ))}
              </div>
            </div>
            <button onClick={() => handleClose(i)} style={{ backgroundColor: T.card2, border: `1px solid ${T.border}`, color: T.white, padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginLeft: 12, flexShrink: 0 }}>Close</button>
          </div>
        </Card>
      ))}
    </div>
  );
};

const WalletScreen = () => {
  const { userData } = useContext(AuthContext);
  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ color: T.white, marginBottom: 24 }}>Wallet</h2>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ color: T.text, fontSize: 13, marginBottom: 6 }}>Total Equity (USDT)</div>
        <div style={{ color: T.white, fontSize: 36, fontWeight: 900 }}>${parseFloat(userData?.virtualBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div style={{ color: T.text, fontSize: 12, marginTop: 8 }}>Paper trading account • No real funds</div>
      </Card>
      <Card>
        <div style={{ color: T.white, fontWeight: 700, marginBottom: 16 }}>Assets</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#26A17B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>₮</div>
            <div><div style={{ color: T.white, fontWeight: 600 }}>USDT</div><div style={{ color: T.text, fontSize: 12 }}>Tether</div></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: T.white, fontWeight: 600 }}>{parseFloat(userData?.virtualBalance || 0).toFixed(2)}</div>
            <div style={{ color: T.text, fontSize: 12 }}>Available</div>
          </div>
        </div>
        {(!userData?.portfolio || userData.portfolio.length === 0) && <div style={{ color: T.text, textAlign: 'center', padding: '16px 0', fontSize: 13 }}>All funds are in USDT. Start trading to open positions.</div>}
      </Card>
    </div>
  );
};

const LoginScreen = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
    if (!email || !password) return setError('Enter email and password.');
    setLoading(true); setError('');
    try { await login(email, password); navigate('/dashboard'); }
    catch (e) { setError(e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' ? 'Invalid email or password.' : e.message); }
    setLoading(false);
  };
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <Card style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ color: T.yellow, fontWeight: 900, fontSize: 22, textAlign: 'center', marginBottom: 6 }}>ATHARVA CAPITAL</div>
        <div style={{ color: T.text, textAlign: 'center', marginBottom: 28, fontSize: 14 }}>Welcome back</div>
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Email</label>
        <Input placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} type="email" style={{ marginBottom: 14 }} />
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Password</label>
        <Input placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} type="password" style={{ marginBottom: 18 }} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <Btn onClick={handleLogin} disabled={loading}>{loading ? 'Logging in...' : 'Login'}</Btn>
        <div style={{ textAlign: 'center', marginTop: 18, color: T.text, fontSize: 13 }}>New here? <Link to="/signup" style={{ color: T.yellow, fontWeight: 600, textDecoration: 'none' }}>Create Account</Link></div>
      </Card>
    </div>
  );
};

const SignupScreen = () => {
  const { signUp } = useContext(AuthContext);
  const navigate = useNavigate();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const handleSignup = async () => {
    if (!email || !password) return setError('Fill in all fields.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setLoading(true); setError('');
    try { await signUp(email, password, name); navigate('/dashboard'); }
    catch (e) { setError(e.code === 'auth/email-already-in-use' ? 'This email is already registered.' : e.message); }
    setLoading(false);
  };
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <Card style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ color: T.yellow, fontWeight: 900, fontSize: 22, textAlign: 'center', marginBottom: 6 }}>ATHARVA CAPITAL</div>
        <div style={{ color: T.text, textAlign: 'center', marginBottom: 28, fontSize: 14 }}>Get $10,000 virtual USDT to trade with</div>
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Your Name</label>
        <Input placeholder="Atharva" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 14 }} />
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Email</label>
        <Input placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} type="email" style={{ marginBottom: 14 }} />
        <label style={{ color: T.text, fontSize: 12, display: 'block', marginBottom: 4 }}>Password</label>
        <Input placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} type="password" style={{ marginBottom: 18 }} onKeyDown={e => e.key === 'Enter' && handleSignup()} />
        {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <Btn onClick={handleSignup} disabled={loading}>{loading ? 'Creating account...' : 'Create Account & Get $10,000'}</Btn>
        <div style={{ textAlign: 'center', marginTop: 18, color: T.text, fontSize: 13 }}>Already registered? <Link to="/login" style={{ color: T.yellow, fontWeight: 600, textDecoration: 'none' }}>Login</Link></div>
      </Card>
    </div>
  );
};

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
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </Router>
      </PriceProvider>
    </AuthProvider>
  );
}
