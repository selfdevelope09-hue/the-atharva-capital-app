import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView } from 'react-native';

export default function MarketScreen() {
  const [coins, setCoins] = useState([]);

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const data = await res.json();
        // USDT pairs filter
        const filtered = data.filter(i => i.symbol.endsWith('USDT')).slice(0, 20);
        setCoins(filtered);
      } catch (e) { console.log(e); }
    };
    fetchMarket();
    const interval = setInterval(fetchMarket, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.brand}>THE ATHARVA CAPITAL</Text>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Pair</Text>
        <Text style={styles.label}>Last Price</Text>
        <Text style={styles.label}>24h Chg</Text>
      </View>
      <FlatList
        data={coins}
        keyExtractor={item => item.symbol}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.symbol}>{item.symbol.replace('USDT', '')}</Text>
            <Text style={styles.price}>${parseFloat(item.lastPrice).toFixed(2)}</Text>
            <View style={[styles.badge, { backgroundColor: item.priceChangePercent > 0 ? '#0ecb81' : '#f6465d' }]}>
              <Text style={styles.change}>{item.priceChangePercent}%</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e11', padding: 15 },
  brand: { color: '#f0b90b', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginVertical: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#2b2f36' },
  label: { color: '#848e9c', fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: '#2b2f36' },
  symbol: { color: '#fff', fontSize: 16, fontWeight: 'bold', width: '30%' },
  price: { color: '#fff', fontSize: 16, width: '40%', textAlign: 'center' },
  badge: { padding: 6, borderRadius: 4, width: '25%', alignItems: 'center' },
  change: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});
