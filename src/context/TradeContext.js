import React, { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';

export const TradeContext = createContext();

export const TradeProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [positions, setPositions] = useState([]);

  // Live PnL: refresh positions every second
  useEffect(() => {
    if (user?.positions) {
      const interval = setInterval(() => {
        const updated = user.positions.map(pos => {
          // Compare to live price (mock logic for now)
          const pnl = (Math.random() * 10) - 5; // Fake PnL simulation
          return { ...pos, pnl };
        });
        setPositions(updated);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <TradeContext.Provider value={{ positions }}>
      {children}
    </TradeContext.Provider>
  );
};
