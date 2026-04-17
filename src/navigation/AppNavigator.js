import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';

import HomeScreen from '../screens/HomeScreen';
import Dashboard from '../screens/Dashboard';
import TradeScreen from '../screens/TradeScreen';
import WalletScreen from '../screens/WalletScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';

const AppNavigator = () => {
  return (
    <Router>
      <div style={{ backgroundColor: '#0b0e11', minHeight: '100vh', color: 'white' }}>
        
        {/* Navbar */}
        <nav style={{
          padding: '15px 20px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <div style={{ color: '#f0b90b', fontWeight: 'bold' }}>
            THE ATHARVA CAPITAL
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <a href="#/">Home</a>
            <a href="#/dashboard">Dashboard</a>
            <a href="#/trade">Trade</a>
            <a href="#/wallet">Wallet</a>
            <a href="#/login">Login</a>
          </div>
        </nav>

        {/* Routes */}
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/trade" element={<TradeScreen />} />
          <Route path="/wallet" element={<WalletScreen />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/signup" element={<SignupScreen />} />
        </Routes>

      </div>
    </Router>
  );
};

export default AppNavigator;
