import React from 'react';
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';

const styles = {
  container: { backgroundColor: '#0b0e11', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontFamily: 'sans-serif' },
  card: { backgroundColor: '#1e2329', padding: '50px', borderRadius: '15px', textAlign: 'center', border: '1px solid #333', boxShadow: '0px 10px 30px rgba(0,0,0,0.5)' },
  logo: { color: '#f0b90b', fontSize: '32px', fontWeight: 'bold', letterSpacing: '2px' },
  founder: { color: '#848e9c', fontSize: '12px', letterSpacing: '4px', margin: '10px 0' },
  button: { display: 'inline-block', marginTop: '30px', padding: '15px 30px', backgroundColor: '#f0b90b', color: 'black', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '16px', transition: '0.3s' }
};

const Home = () => (
  <div style={styles.card}>
    <div style={styles.logo}>THE ATHARVA CAPITAL</div>
    <div style={styles.founder}>ATHARVA DARSHANWAR</div>
    <div style={{width: '50px', height: '2px', backgroundColor: '#f0b90b', margin: '20px auto'}}></div>
    <p>World Class Virtual Trading Platform</p>
    <p style={{color: '#02c076', fontSize: '14px'}}>● System Live</p>
    
    {/* 🚀 Yeh hai woh button jo dashboard kholega */}
    <Link to="/dashboard" style={styles.button}>ENTER TERMINAL</Link>
  </div>
);

const Dashboard = () => (
  <div style={styles.container}>
    <div style={styles.card}>
      <div style={styles.logo}>DASHBOARD</div>
      <p>Market Data Loading...</p>
      <Link to="/" style={{color: '#848e9c', textDecoration: 'none', fontSize: '12px'}}>← LOGOUT</Link>
    </div>
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
