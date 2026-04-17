import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';

const App = () => {
  return (
    <Router>
      <div style={{ backgroundColor: '#0b0e11', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <nav style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ color: '#f0b90b', margin: 0, fontSize: '20px' }}>THE ATHARVA CAPITAL</h1>
          <div style={{ color: '#02c076', fontSize: '14px' }}>● SYSTEM LIVE</div>
        </nav>
        
        <div style={{ padding: '20px', height: '80vh' }}>
          {/* Asli Live Chart */}
          <iframe 
            src="https://s.tradingview.com/widgetembed/?symbol=BINANCE%3ABTCUSDT&interval=D&theme=dark&style=1&timezone=Etc%2FUTC&locale=en"
            width="100%"
            height="100%"
            frameBorder="0"
            style={{ borderRadius: '10px', border: '1px solid #333' }}
          ></iframe>
        </div>

        <div style={{ textAlign: 'center', padding: '20px', color: '#848e9c', fontSize: '12px' }}>
          ATHARVA DARSHANWAR | PRO TERMINAL v1.1
        </div>
      </div>
    </Router>
  );
};

export default App;
