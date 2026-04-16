import React, { createContext, useState, useEffect } from 'react';

export const PriceContext = createContext();

export const PriceProvider = ({ children }) => {
  const [prices, setPrices] = useState({});

  useEffect(() => {
    // Sabhi symbols ka data ek saath lane ke liye Binance Stream
    // !miniTicker@arr sabhi pairs ki price real-time deta hai
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      let newPrices = {};
      data.forEach(coin => {
        if (coin.s.endsWith('USDT')) {
          newPrices[coin.s] = {
            price: parseFloat(coin.c).toFixed(2),
            close: parseFloat(coin.c),
            open: parseFloat(coin.o)
          };
        }
      });
      // Sirf changes ko update karna taaki performance bani rahe
      setPrices(prev => ({ ...prev, ...newPrices }));
    };

    ws.onerror = (e) => console.log("WS Error: ", e);
    ws.onclose = () => console.log("WS Closed, reconnecting...");

    return () => ws.close();
  }, []);

  return (
    <PriceContext.Provider value={prices}>
      {children}
    </PriceContext.Provider>
  );
};
