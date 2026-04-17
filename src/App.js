import React from 'react';
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';

const styles = {
  container: { backgroundColor: '#0b0e11', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontFamily: 'sans-serif' },
  card: { backgroundColor: '#1e2329', padding: '40px', borderRadius: '15px', textAlign: 'center', border: '1px solid #333', minWidth: '300px' },
  logo: { color: '#f0b90b', fontSize: '28px', fontWeight: 'bold', marginBottom: '20px' },
  btn: { padding: '12px 24px', backgroundColor: '#f0b90b', color: 'black', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold', display: 'inline-block', marginTop: '20px' }
};

const Home = () => (
  <div style={styles.card}>
    <div style={styles.logo}>THE ATHARVA CAPITAL</div>
    <p>World Class Virtual Trading Platform</p>
    <div style={{color: '#02c076'}}>● System Online</div>
    {/* 🚀 Yeh Button Dashboard kholega */}
    <Link to="/dashboard" style={styles.btn}>ENTER TERMINAL</Link>
  </div>
);

const Dashboard = () => (
  <div style={styles.card}>
    <div style={{color: '#f0b90b', fontSize: '20px', fontWeight: 'bold'}}>TRADING DASHBOARD</div>
    <div style={{margin: '20px 0', textAlign: 'left', backgroundColor: '#2b3139', padding: '15px', borderRadius: '8px'}}>
        <p style={{fontSize: '12px', color: '#848e9c', margin: 0}}>BTC / USDT</p>
        <h2 style={{margin: '5px 0'}}>$ 73,450.00</h2>
        <p style={{fontSize: '12px', color: '#02c076', margin: 0}}>+2.45% (24h)</p>
    </div>
    <p style={{fontSize: '14px', color: '#848e9c'}}>Real-time Charts Integration Pending...</p>
    <Link to="/" style={{color: '#848e9c', fontSize: '12px', textDecoration: 'none', display: 'block', marginTop: '20px'}}>← BACK TO HOME</Link>
  </div>
);

export default function App() {
  return (
    <Router>
      <div style={styles.container}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </Router>
  );
}
