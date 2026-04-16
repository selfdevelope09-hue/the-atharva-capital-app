import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';

export default function WatchlistScreen() {
  const [search, setSearch] = useState('');
  // Ye list Firestore se aayegi
  const [watchlist, setWatchlist] = useState([
    { id: '1', symbol: 'BTC', price: '64,250', change: '+2.5%' },
    { id: '2', symbol: 'ETH', price: '3,450', change: '-1.2%' },
  ]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Watchlist</Text>
      <TextInput 
        style={styles.searchBar} 
        placeholder="Search Coin Pair..." 
        placeholderTextColor="#848e9c"
        onChangeText={setSearch}
      />
      
      <FlatList
        data={watchlist}
        renderItem={({ item }) => (
          <View style={styles.coinItem}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Star size={16} color="#f0b90b" fill="#f0b90b" />
              <Text style={styles.symbolText}>  {item.symbol}/USDT</Text>
            </View>
            <View style={{alignItems: 'flex-end'}}>
              <Text style={styles.priceText}>${item.price}</Text>
              <Text style={{color: item.change.includes('+') ? '#0ecb81' : '#f6465d'}}>{item.change}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e11', padding: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 20, marginTop: 40 },
  searchBar: { backgroundColor: '#2b2f36', color: '#fff', padding: 12, borderRadius: 25, marginBottom: 20 },
  coinItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 20, borderBottomWidth: 0.5, borderBottomColor: '#2b2f36' },
  symbolText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  priceText: { color: '#fff', fontSize: 16 }
});
