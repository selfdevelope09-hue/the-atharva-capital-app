import React, { useState, createContext, useContext } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';

// --- 1. AUTH CONTEXT (Login/Logout Logic) ---
const AuthContext = createContext();
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const login = (userData) => setUser(userData);
  const logout = () => setUser(null);
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- 2. THEME & STYLES ---
const theme = {
  bg: '#0b0e11', card: '#1e2329', yellow: '#f0b90b', green: '#02c076', red: '#f6465d', text: '#848e9c'
};

const commonStyles = {
  btn: { backgroundColor: theme.yellow, color: 'black', border: 'none', padding: '10px 20px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none' },
  input: { backgroundColor: '#2b3139', border: '1px solid #444', color: 'white', padding: '10px', borderRadius: '5px', marginBottom: '10px', width: '100%' }
};

// --- 3. SCREENS (Converted to Web HTML) ---

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  return (
    <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 20px', backgroundColor: theme.card, borderBottom: '1px solid #333' }}>
      <Link to="/" style={{ color: theme.yellow, fontWeight: 'bold', textDecoration: 'none' }}>ATHARVA CAPITAL</Link>
      <div style={{ display: 'flex', gap: '15px' }}>
        {user ? (
          <>
            <Link to="/dashboard" style={{ color: 'white', textDecoration: 'none' }}>Terminal</Link>
            <Link to="/wallet" style={{ color: 'white', textDecoration: 'none' }}>Wallet</Link>
            <button onClick={logout} style={{ background: 'none', border: 'none', color: theme.red, cursor: 'pointer' }}>Logout</button>
          </>
        ) : (
          <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>Login</Link>
        )}
      </div>
    </nav>
  );
};

const Login = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
      <div style={{ backgroundColor: theme.card, padding: '40px', borderRadius: '10px', width: '300px' }}>
        <h2 style={{ color: theme.yellow }}>Login</h2>
        <input style={commonStyles.input} placeholder="Email" />
        <input style={commonStyles.input} type="password" placeholder="Password" />
        <button style={{ ...commonStyles.btn, width: '100%' }} onClick={() => { login({ name: 'Atharva' }); navigate('/dashboard'); }}>Enter System</button>
      </div>
    </div>
  );
};

const Dashboard = () => (
  <div style={{ padding: '20px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '20px' }}>
      <div style={{ backgroundColor: theme.card, padding: '20px', borderRadius: '10px', height: '500px' }}>
        <h3 style={{ color: theme.yellow }}>BTC/USDT Live Chart</h3>
        <iframe 
          src="https://s.tradingview.com/widgetembed/?symbol=BINANCE%3ABTCUSDT&theme=dark" 
          width="100%" height="90%" frameBorder="0"
        />
      </div>
      <div style={{ backgroundColor: theme.card, padding: '20px', borderRadius: '10px' }}>
        <h3>Order Book</h3>
        <p style={{ color: theme.green }}>Buy: $73,200</p>
        <p style={{ color: theme.red }}>Sell: $73,210</p>
        <button style={{ ...commonStyles.btn, width: '100%', marginTop: '20px' }}>Place Trade</button>
      </div>
    </div>
  </div>
);

// --- 4. MAIN APP STRUCTURE ---
export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div style={{ backgroundColor: theme.bg, minHeight: '100vh', color: 'white', fontFamily: 'Arial' }}>
          <Navbar />
          <Routes>
            <Route path="/" element={<div style={{ textAlign: 'center', marginTop: '100px' }}><h1>Welcome to Atharva Capital</h1><Link to="/login" style={commonStyles.btn}>Start Trading</Link></div>} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/wallet" element={<div><h2 style={{ padding: '20px' }}>My Assets: $10,000.00</h2></div>} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}
