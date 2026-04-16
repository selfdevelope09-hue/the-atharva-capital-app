import { db } from './FirebaseConfig';
import { doc, updateDoc, increment, arrayUnion, getDoc } from 'firebase/firestore';

export const executeTrade = async (userId, symbol, price, amount, type) => {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const currentBalance = userSnap.data().virtualBalance;

  if (type === 'BUY') {
    if (currentBalance < amount) return { status: 'error', message: 'Insufficient Funds' };

    await updateDoc(userRef, {
      virtualBalance: increment(-amount),
      portfolio: arrayUnion({
        symbol: symbol,
        buyPrice: price,
        quantity: amount / price,
        time: new Date()
      })
    });
  }
  // Sell logic yahan add ho sakti hai
  return { status: 'success', message: 'Trade Executed!' };
};
