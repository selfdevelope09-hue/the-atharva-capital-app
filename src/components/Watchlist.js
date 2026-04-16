import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Star } from 'lucide-react-native';

export default function WatchlistItem({ symbol, price, change }) {
  return (
    <TouchableOpacity style={styles.item}>
      <View style={styles.left}>
        <Star size={18} color="#f0b90b" fill="#f0b90b" />
        <Text style={styles.symbol}>{symbol}<Text style={styles.pair}>/USDT</Text></Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.price}>${price}</Text>
        <Text style={[styles.change, {color: change > 0 ? '#0ecb81' : '#f6465d'}]}>
          {change > 0 ? '+' : ''}{change}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: '#2b2f36' },
  left: { flexDirection: 'row', alignItems: 'center' },
  symbol: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  pair: { color: '#848e9c', fontSize: 12 },
  price: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  change: { fontSize: 12, marginTop: 4, textAlign: 'right' }
});
