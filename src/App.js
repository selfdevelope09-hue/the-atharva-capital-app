import React from 'react';
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';

// Simple HTML Styles
const styles = {
  container: { backgroundColor: '#0b0e11', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontFamily: 'sans-serif' },
  card: { backgroundColor: '#1e2329', padding: '40px', borderRadius: '15px', textAlign: 'center', border: '1px solid #333' },
  logo: { color: '#f0b90b', fontSize: '30px', fontWeight: 'bold', marginBottom: '10px' },
  button: { display: 'inline-block', marginTop: '20px', padding: '10px 20px', backgroundColor: '#f0b90b', color: 'black', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold' }
};

const Home = () => (
  <div style={styles.card}>
    <div style={styles.logo}>THE ATHARVA CAPITAL</div>
    <p>SYSTEM ONLINE ✅</p>
    <Link to="/dashboard" style={styles.button}>OPEN DASHBOARD</Link>
  </div>
);

const Dashboard = () => (
  <div style={styles.card}>
    <div style={styles.logo}>DASHBOARD</div>
    <p>Trading Terminal Active</p>
    <Link to="/" style={styles.button}>BACK TO HOME</Link>
  </div>
);

export default function App() {
  return (
    <Router>
      <div style={styles.container}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
    </Router>
  );
}
