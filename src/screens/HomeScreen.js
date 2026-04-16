import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { PriceContext } from '../context/PriceContext';
import { Rocket, ShieldCheck, PieChart, Users, Crown } from 'lucide-react-native';

export default function HomeScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const allPrices = useContext(PriceContext);
  const [topGainer, setTopGainer] = useState([]);

  useEffect(() => {
    const list = Object.keys(allPrices)
      .map(key => ({ symbol: key, ...allPrices[key] }))
      .sort((a, b) => (b.price / b.open) - (a.price / a.open))
      .slice(0, 5);
    setTopGainer(list);
  }, [allPrices]);

  return (
    <ScrollView style={styles.container}>
      {/* 1. Founder Profile Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Welcome back,</Text>
          {/* AAPKA NAAM YAHAN HAI */}
          <Text style={styles.userName}>Atharva Darshanwar</Text>
          <View style={styles.founderBadge}>
             <Crown color="#f0b90b" size={12} />
             <Text style={styles.founderText}>Founder & CEO</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.verifiedBadge}>
          <ShieldCheck color="#f0b90b" size={20} />
          <Text style={styles.badgeText}>Verified</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Main Portfolio Banner */}
      <View style={styles.balanceCard}>
        <Text style={styles.label}>The Atharva Capital Balance</Text>
        <Text style={styles.balance}>${user?.virtualBalance?.toLocaleString()} <Text style={styles.usdt}>USDT</Text></Text>
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>Global Rank: <Text style={{color:'#f0b90b'}}>#1 World Trader</Text></Text>
        </View>
      </View>

      {/* 3. Quick Actions */}
      <View style={styles.actionGrid}>
        <ActionItem icon={<Rocket color="#f0b90b"/>} label="Launchpad" />
        <ActionItem icon={<PieChart color="#f0b90b"/>} label="Empire Stats" />
        <ActionItem icon={<Users color="#f0b90b"/>} label="My Team" />
        <ActionItem icon={<ShieldCheck color="#f0b90b"/>} label="Security" />
      </View>

      {/* 4. Live Market Trends */}
      <Text style={styles.sectionTitle}>Market Trends</Text>
      {topGainer.map((item, index) => (
        <TouchableOpacity key={index} style={styles.coinRow} onPress={() => navigation.navigate('Trade')}>
          <View>
            <Text style={styles.coinSym}>{item.symbol.replace('USDT', '')}</Text>
            <Text style={styles.coinVol}>24h Vol: ${(Math.random() * 10).toFixed(2)}B</Text>
          </View>
          <View style={{alignItems: 'flex-end'}}>
            <Text style={styles.coinPrice}>${item.price}</Text>
            <View style={styles.gainerBadge}>
              <Text style={styles.gainerText}>+{( (item.price/item.open - 1) * 100 ).toFixed(2)}%</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
      
      <View style={{height: 100}} /> 
    </ScrollView>
  );
}

const ActionItem = ({ icon, label }) => (
  <TouchableOpacity style={styles.actionItem}>
    <View style={styles.iconCircle}>{icon}</View>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e11', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 50, marginBottom: 25 },
  welcome: { color: '#848e9c', fontSize: 14 },
  userName: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  founderBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  founderText: { color: '#f0b90b', fontSize: 12, fontWeight: 'bold', marginLeft: 5, letterSpacing: 1 },
  verifiedBadge: { flexDirection: 'row', backgroundColor: '#1e2329', padding: 8, borderRadius: 20, alignItems: 'center' },
  badgeText: { color: '#f0b90b', marginLeft: 5, fontSize: 12, fontWeight: 'bold' },
  balanceCard: { backgroundColor: '#1e2329', padding: 25, borderRadius: 15, marginBottom: 25, borderLeftWidth: 4, borderLeftColor: '#f0b90b' },
  label: { color: '#848e9c', fontSize: 12 },
  balance: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginVertical: 8 },
  usdt: { fontSize: 16, color: '#f0b90b' },
  statsText: { color: '#848e9c', fontSize: 13 },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  actionItem: { alignItems: 'center', width: '22%' },
  iconCircle: { backgroundColor: '#2b2f36', padding: 12, borderRadius: 50, marginBottom: 8 },
  actionLabel: { color: '#848e9c', fontSize: 11 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  coinRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: '#2b2f36' },
  coinSym: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  coinVol: { color: '#848e9c', fontSize: 11 },
  coinPrice: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  gainerBadge: { backgroundColor: '#0ecb81', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, marginTop: 5 },
  gainerText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});
