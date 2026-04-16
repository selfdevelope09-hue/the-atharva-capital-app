import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function PositionCard({ pos }) {
  const [currentPrice, setCurrentPrice] = useState(pos.entryPrice);
  
  // Real-time price tracking for PnL calculation
  useEffect(() => {
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${pos.symbol.toLowerCase()}@ticker`);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setCurrentPrice(parseFloat(data.c));
    };
    return () => ws.close();
  }, []);

  // PnL Calculation Logic
  const priceDiff = pos.type === 'LONG' ? (currentPrice - pos.entryPrice) : (pos.entryPrice - currentPrice);
  const pnl = (priceDiff / pos.entryPrice) * pos.totalSize * pos.leverage;
  const roe = (pnl / pos.margin) * 100;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={[styles.symbol, {color: pos.type === 'LONG' ? '#0ecb81' : '#f6465d'}]}>
          {pos.symbol} {pos.type} {pos.leverage}x
        </Text>
        <Text style={[styles.pnl, {color: pnl >= 0 ? '#0ecb81' : '#f6465d'}]}>
          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USDT ({roe.toFixed(2)}%)
        </Text>
      </View>

      <View style={styles.details}>
        <View>
          <Text style={styles.label}>Size (USDT)</Text>
          <Text style={styles.val}>{pos.totalSize}</Text>
        </View>
        <View>
          <Text style={styles.label}>Entry Price</Text>
          <Text style={styles.val}>{pos.entryPrice}</Text>
        </View>
        <View>
          <Text style={styles.label}>Mark Price</Text>
          <Text style={styles.val}>{currentPrice.toFixed(2)}</Text>
        </View>
      </View>
      
      <TouchableOpacity style={styles.closeBtn}>
        <Text style={styles.closeText}>Close Position</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1e2329', padding: 15, borderRadius: 8, marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  symbol: { fontWeight: 'bold', fontSize: 16 },
  pnl: { fontWeight: 'bold', fontSize: 16 },
  details: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  label: { color: '#848e9c', fontSize: 11 },
  val: { color: '#fff', fontSize: 13, marginTop: 4 },
  closeBtn: { backgroundColor: '#2b2f36', padding: 10, borderRadius: 4, alignItems: 'center' },
  closeText: { color: '#fff', fontWeight: 'bold' }
});
