import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import PositionCard from '../components/PositionCard'; // Jo humne pehle banaya tha

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [totalPnL, setTotalPnL] = useState(0);

  return (
    <ScrollView style={styles.container}>
      {/* Wallet Card */}
      <View style={styles.walletCard}>
        <Text style={styles.walletLabel}>Total Equity (USDT)</Text>
        <Text style={styles.balance}>${user?.virtualBalance?.toLocaleString()}</Text>
        <View style={styles.pnlRow}>
          <Text style={styles.pnlLabel}>Today's PnL: </Text>
          <Text style={[styles.pnlValue, {color: totalPnL >= 0 ? '#0ecb81' : '#f6465d'}]}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Open Positions Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Open Positions ({user?.positions?.length || 0})</Text>
      </View>

      {user?.positions?.length > 0 ? (
        user.positions.map((item, index) => (
          <PositionCard key={index} pos={item} />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No Active Trades. Start Trading!</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e11', padding: 15 },
  walletCard: { backgroundColor: '#1e2329', padding: 25, borderRadius: 12, marginTop: 40, marginBottom: 20 },
  walletLabel: { color: '#848e9c', fontSize: 14 },
  balance: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: 10 },
  pnlRow: { flexDirection: 'row', marginTop: 15 },
  pnlLabel: { color: '#848e9c', fontSize: 14 },
  pnlValue: { fontSize: 14, fontWeight: 'bold' },
  sectionHeader: { marginBottom: 15 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#848e9c' }
});
