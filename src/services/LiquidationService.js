import { liquidationPrice } from '../tradingEngine';

export { liquidationPrice };

export const checkLiquidation = (entryPrice, leverage, type, currentMarkPrice) => {
  const liq = liquidationPrice(type, entryPrice, leverage);
  if (!Number.isFinite(liq) || !Number.isFinite(currentMarkPrice)) return false;
  if (type === 'LONG') return currentMarkPrice <= liq;
  if (type === 'SHORT') return currentMarkPrice >= liq;
  return false;
};
