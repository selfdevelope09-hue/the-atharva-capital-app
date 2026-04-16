import React, { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';

export const TradeContext = createContext();

export const TradeProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [positions, setPositions] = useState([]);

  // Live PnL Logic: Har 1 second mein positions update karna
  useEffect(() => {
    if (user?.positions) {
      const interval = setInterval(() => {
        const updated = user.positions.map(pos => {
          // Yahan hume Live Price se compare karna hoga (Mock logic for now)
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
