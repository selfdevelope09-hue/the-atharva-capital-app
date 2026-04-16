import React, { useContext } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function WalletScreen() {
  const { user } = useContext(AuthContext);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Wallet</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Equity (USDT)</Text>
        <Text style={styles.balanceAmt}>${user?.virtualBalance?.toLocaleString()}</Text>
      </View>

      <Text style={styles.sectionTitle}>Assets</Text>
      <FlatList
        data={user?.portfolio}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.assetRow}>
            <Text style={styles.assetSymbol}>{item.symbol.replace('USDT','')}</Text>
            <View style={{alignItems: 'flex-end'}}>
              <Text style={styles.assetQty}>{item.quantity.toFixed(6)}</Text>
              <Text style={styles.assetVal}>Avg: ${item.buyPrice}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{color: '#848e9c', textAlign: 'center', marginTop: 20}}>No assets found. Start trading!</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e11', padding: 20 },
  header: { marginTop: 40, marginBottom: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  balanceCard: { backgroundColor: '#1e2329', padding: 25, borderRadius: 12, marginBottom: 30 },
  balanceLabel: { color: '#848e9c', fontSize: 14 },
  balanceAmt: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: 10 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  assetRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: '#2b2f36' },
  assetSymbol: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  assetQty: { color: '#fff', fontSize: 16 },
  assetVal: { color: '#848e9c', fontSize: 12 }
});
