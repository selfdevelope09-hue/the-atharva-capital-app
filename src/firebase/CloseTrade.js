import { db } from './FirebaseConfig';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { grossPnlUsdt, quantityFromNotional } from '../tradingEngine';

export const closePosition = async (userId, positionIndex, currentPrice) => {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();
  const pos = userData.positions[positionIndex];
  const entry = parseFloat(pos.entryPrice);
  const qty =
    Number.isFinite(parseFloat(pos.quantity)) && parseFloat(pos.quantity) > 0
      ? parseFloat(pos.quantity)
      : quantityFromNotional(parseFloat(pos.totalSize), entry);
  const finalPnL = grossPnlUsdt(pos.type, entry, currentPrice, qty);

  // Remove position and update balance
  const updatedPositions = userData.positions.filter((_, i) => i !== positionIndex);
  
  await updateDoc(userRef, {
    virtualBalance: increment(pos.margin + finalPnL), // Margin wapas + Profit/Loss
    positions: updatedPositions,
    tradeHistory: increment(1) // Just to track total trades
  });

  return { success: true, pnl: finalPnL };
};
