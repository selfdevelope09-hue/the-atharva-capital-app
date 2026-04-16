import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function OrderBook() {
  const mockData = {
    asks: [['64250.10', '0.05'], ['64249.50', '1.20'], ['64248.00', '0.45']],
    bids: [['64245.20', '0.80'], ['64244.00', '2.15'], ['64243.80', '0.10']]
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order Book</Text>
      <View style={styles.header}>
        <Text style={styles.hText}>Price</Text>
        <Text style={styles.hText}>Amount</Text>
      </View>
      
      {/* Sells (Asks) */}
      {mockData.asks.map((item, i) => (
        <View key={i} style={styles.row}>
          <Text style={{color: '#f6465d'}}>{item[0]}</Text>
          <Text style={{color: '#fff'}}>{item[1]}</Text>
        </View>
      ))}

      <Text style={styles.midPrice}>64,247.20</Text>

      {/* Buys (Bids) */}
      {mockData.bids.map((item, i) => (
        <View key={i} style={styles.row}>
          <Text style={{color: '#0ecb81'}}>{item[0]}</Text>
          <Text style={{color: '#fff'}}>{item[1]}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', padding: 10, backgroundColor: '#0b0e11' },
  title: { color: '#848e9c', fontSize: 12, marginBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  hText: { color: '#848e9c', fontSize: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  midPrice: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginVertical: 10, textAlign: 'center' }
});
