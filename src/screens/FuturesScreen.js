import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';

export default function FuturesScreen() {
  const [leverage, setLeverage] = useState(10);
  const [orderType, setOrderType] = useState('Limit'); // Limit or Market

  return (
    <ScrollView style={styles.container}>
      {/* Top Header: Pair Selection */}
      <View style={styles.pairHeader}>
        <Text style={styles.pairText}>BTCUSDT <Text style={styles.leverageBadge}>{leverage}x</Text></Text>
        <Text style={styles.indexPrice}>Index: 64,120.50</Text>
      </View>

      <View style={styles.mainLayout}>
        {/* Left: Trading Panel */}
        <View style={styles.tradePanel}>
          <View style={styles.typeSelector}>
            {['Limit', 'Market'].map(t => (
              <TouchableOpacity key={t} onPress={() => setOrderType(t)} style={[styles.typeBtn, orderType === t && styles.activeType]}>
                <Text style={{color: orderType === t ? '#000' : '#848e9c'}}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput style={styles.input} placeholder="Price" placeholderTextColor="#848e9c" keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="Amount (USDT)" placeholderTextColor="#848e9c" keyboardType="numeric" />

          {/* Leverage Slider */}
          <Text style={styles.label}>Leverage</Text>
          <Slider
            minimumValue={1}
            maximumValue={125}
            step={1}
            value={leverage}
            onValueChange={setLeverage}
            minimumTrackTintColor="#f0b90b"
          />
          <View style={styles.leverageValues}>
            <Text style={styles.vText}>1x</Text><Text style={styles.vText}>125x</Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.buyBtn}><Text style={styles.btnText}>Buy / Long</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sellBtn}><Text style={styles.btnText}>Sell / Short</Text></TouchableOpacity>
          </View>
        </View>

        {/* Right: Order Book Mockup */}
        <View style={styles.orderBook}>
          <Text style={styles.obTitle}>Order Book</Text>
          {[...Array(5)].map((_, i) => (
            <View key={i} style={styles.obRow}><Text style={{color: '#f6465d'}}>64210.{i}</Text><Text style={{color: '#fff'}}>0.02</Text></View>
          ))}
          <Text style={styles.midPrice}>64,120.00</Text>
          {[...Array(5)].map((_, i) => (
            <View key={i} style={styles.obRow}><Text style={{color: '#0ecb81'}}>64119.{i}</Text><Text style={{color: '#fff'}}>1.50</Text></View>
          ))}
        </View>
      </View>

      {/* Positions Section */}
      <View style={styles.positionSection}>
        <Text style={styles.posTitle}>Open Positions (1)</Text>
        <View style={styles.posCard}>
          <View style={styles.posHeader}><Text style={styles.posName}>BTCUSDT Long {leverage}x</Text></View>
          <View style={styles.posBody}>
            <View><Text style={styles.posLabel}>Unrealized PNL (USDT)</Text><Text style={styles.pnlText}>+45.20 (12.4%)</Text></View>
            <View><Text style={styles.posLabel}>Size (USDT)</Text><Text style={styles.valText}>500.00</Text></View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e11', padding: 10 },
  pairHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, marginBottom: 15 },
  pairText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  leverageBadge: { color: '#f0b90b', fontSize: 14 },
  indexPrice: { color: '#848e9c', fontSize: 12 },
  mainLayout: { flexDirection: 'row', justifyContent: 'space-between' },
  tradePanel: { width: '58%' },
  orderBook: { width: '38%' },
  typeSelector: { flexDirection: 'row', backgroundColor: '#2b2f36', borderRadius: 4, marginBottom: 15 },
  typeBtn: { flex: 1, padding: 8, alignItems: 'center' },
  activeType: { backgroundColor: '#f0b90b', borderRadius: 4 },
  input: { backgroundColor: '#2b2f36', color: '#fff', padding: 10, borderRadius: 4, marginBottom: 10 },
  label: { color: '#848e9c', fontSize: 12, marginTop: 10 },
  leverageValues: { flexDirection: 'row', justifyContent: 'space-between' },
  vText: { color: '#848e9c', fontSize: 10 },
  actionRow: { flexDirection: 'row', marginTop: 20 },
  buyBtn: { backgroundColor: '#0ecb81', flex: 1, padding: 12, marginRight: 5, borderRadius: 4, alignItems: 'center' },
  sellBtn: { backgroundColor: '#f6465d', flex: 1, padding: 12, borderRadius: 4, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  obTitle: { color: '#848e9c', fontSize: 12, marginBottom: 10 },
  obRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  midPrice: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginVertical: 8, textAlign: 'center' },
  positionSection: { marginTop: 30, borderTopWidth: 1, borderTopColor: '#2b2f36', paddingTop: 15 },
  posTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  posCard: { backgroundColor: '#1e2329', padding: 15, borderRadius: 8 },
  posName: { color: '#0ecb81', fontWeight: 'bold' },
  posBody: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  posLabel: { color: '#848e9c', fontSize: 10 },
  pnlText: { color: '#0ecb81', fontSize: 14, fontWeight: 'bold' },
  valText: { color: '#fff', fontSize: 14, textAlign: 'right' }
});
