import { db } from './FirebaseConfig';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';

export const closePosition = async (userId, positionIndex, currentPrice) => {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();
  const pos = userData.positions[positionIndex];

  // Calculate PnL
  const priceDiff = pos.type === 'LONG' ? (currentPrice - pos.entryPrice) : (pos.entryPrice - currentPrice);
  const rawPnL = (priceDiff / pos.entryPrice) * pos.totalSize * pos.leverage;

  // Platform Fees (Maker/Taker - 0.05%)
  const fee = pos.totalSize * 0.0005;
  const finalPnL = rawPnL - fee;

  // Remove position and update balance
  const updatedPositions = userData.positions.filter((_, i) => i !== positionIndex);
  
  await updateDoc(userRef, {
    virtualBalance: increment(pos.margin + finalPnL), // Margin wapas + Profit/Loss
    positions: updatedPositions,
    tradeHistory: increment(1) // Just to track total trades
  });

  return { success: true, pnl: finalPnL };
};
