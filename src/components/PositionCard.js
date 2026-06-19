import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useHotPrices } from '../hooks/useHotPrices';
import { grossPnlUsdt, quantityFromNotional } from '../tradingEngine';
import { lookupLivePrice, normalizeBinanceSymbol, parseLiveMarkPrice } from '../utils/marketSymbol';

export default function PositionCard({ pos, onPositionClose }) {
  const allPrices = useHotPrices();
  const sym = normalizeBinanceSymbol(pos.symbol);
  const mark = parseLiveMarkPrice(lookupLivePrice(allPrices, sym));
  const currentPrice = Number.isFinite(mark) ? mark : parseFloat(pos.entryPrice);
  const entry = parseFloat(pos.entryPrice);
  const qty =
    Number.isFinite(parseFloat(pos.quantity)) && parseFloat(pos.quantity) > 0
      ? parseFloat(pos.quantity)
      : quantityFromNotional(parseFloat(pos.totalSize), entry);
  const pnl = grossPnlUsdt(pos.type, entry, currentPrice, qty);
  const roe = (pnl / pos.margin) * 100;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.symbol, {color: pos.type === 'LONG' ? '#0ecb81' : '#f6465d'}]}>
          {pos.symbol} <Text style={styles.sideText}>{pos.type} {pos.leverage}x</Text>
        </Text>
        <Text style={[styles.pnl, {color: pnl >= 0 ? '#0ecb81' : '#f6465d'}]}>
          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USDT
        </Text>
      </View>

      <View style={styles.dataRow}>
        <View>
          <Text style={styles.label}>ROE %</Text>
          <Text style={[styles.val, {color: roe >= 0 ? '#0ecb81' : '#f6465d'}]}>{roe.toFixed(2)}%</Text>
        </View>
        <View>
          <Text style={styles.label}>Entry Price</Text>
          <Text style={styles.val}>{pos.entryPrice.toFixed(2)}</Text>
        </View>
        <View>
          <Text style={styles.label}>Mark Price</Text>
          <Text style={styles.val}>{currentPrice.toFixed(2)}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.closeBtn} onPress={() => onPositionClose(currentPrice)}>
        <Text style={styles.closeText}>Close Position</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1e2329', padding: 15, borderRadius: 8, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  symbol: { fontSize: 16, fontWeight: 'bold' },
  sideText: { fontSize: 12, color: '#848e9c' },
  pnl: { fontSize: 16, fontWeight: 'bold' },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  label: { color: '#848e9c', fontSize: 10, marginBottom: 4 },
  val: { color: '#fff', fontSize: 14, fontWeight: '500' },
  closeBtn: { backgroundColor: '#2b2f36', padding: 10, borderRadius: 4, alignItems: 'center' },
  closeText: { color: '#fff', fontSize: 14, fontWeight: '600' }
});
