// Ye function check karega ki user ka margin khatam toh nahi ho gaya
export const checkLiquidation = (entryPrice, leverage, type, currentMarkPrice) => {
  // Liquidation Price Calculation
  // LONG: Entry * (1 - 1/Leverage)
  // SHORT: Entry * (1 + 1/Leverage)
  
  let liqPrice;
  if (type === 'LONG') {
    liqPrice = entryPrice * (1 - (1 / leverage));
    return currentMarkPrice <= liqPrice;
  } else {
    liqPrice = entryPrice * (1 + (1 / leverage));
    return currentMarkPrice >= liqPrice;
  }
};
