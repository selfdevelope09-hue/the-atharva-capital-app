import { db } from './FirebaseConfig';
import { doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';

export const executeAdvancedTrade = async (userId, data) => {
  const { symbol, price, amount, leverage, type, tp, sl } = data;
  const userRef = doc(db, "users", userId);
  
  // Margin: e.g. 100 USDT notional at 10x → 10 USDT margin from wallet
  const marginRequired = amount / leverage;

  try {
    await updateDoc(userRef, {
      virtualBalance: increment(-marginRequired),
      positions: arrayUnion({
        symbol,
        entryPrice: price,
        leverage,
        margin: marginRequired,
        totalSize: amount,
        type: type, // LONG or SHORT
        tp: tp || null,
        sl: sl || null,
        status: 'OPEN',
        time: new Date()
      })
    });
    return { success: true, message: `${type} Position Opened!` };
  } catch (e) {
    return { success: false, message: e.message };
  }
};
