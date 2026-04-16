import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import ChartWidget from '../components/ChartWidget';

export default function AdvancedTradeScreen() {
  const [leverage, setLeverage] = useState(10);
  const [side, setSide] = useState('Buy'); // Buy or Sell

  return (
    <ScrollView style={styles.container}>
      {/* 1. Live Chart Section */}
      <ChartWidget symbol="BTCUSDT" />

      {/* 2. Order Selection */}
      <View style={styles.tradeArea}>
        <View style={styles.sideSelector}>
          <TouchableOpacity 
            onPress={() => setSide('Buy')} 
            style={[styles.sideBtn, side === 'Buy' && styles.activeBuy]}>
            <Text style={styles.sideText}>Buy / Long</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setSide('Sell')} 
            style={[styles.sideBtn, side === 'Sell' && styles.activeSell]}>
            <Text style={styles.sideText}>Sell / Short</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Leverage Slider (Binance Style) */}
        <View style={styles.leverageContainer}>
          <Text style={styles.label}>Leverage: <Text style={{color:'#f0b90b'}}>{leverage}x</Text></Text>
          <Slider
            style={{width: '100%', height: 40}}
            minimumValue={1}
            maximumValue={125}
            step={1}
            value={leverage}
            onValueChange={setLeverage}
            minimumTrackTintColor="#f0b90b"
            maximumTrackTintColor="#2b2f36"
            thumbTintColor="#f0b90b"
          />
          <View style={styles.marks}>
            <Text style={styles.markText}>1x</Text><Text style={styles.markText}>25x</Text>
            <Text style={styles.markText}>50x</Text><Text style={styles.markText}>125x</Text>
          </View>
        </View>

        {/* 4. TP/SL Inputs */}
        <View style={styles.inputRow}>
          <TextInput style={styles.input} placeholder="Take Profit Price" placeholderTextColor="#848e9c" keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="Stop Loss Price" placeholderTextColor="#848e9c" keyboardType="numeric" />
        </View>

        {/* 5. Final Execution Button */}
        <TouchableOpacity style={[styles.execBtn, side === 'Buy' ? styles.bgGreen : styles.bgRed]}>
          <Text style={styles.execText}>{side} BTC with {leverage}x Leverage</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e11' },
  tradeArea: { padding: 15 },
  sideSelector: { flexDirection: 'row', backgroundColor: '#1e2329', borderRadius: 8, marginBottom: 20 },
  sideBtn: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 8 },
  activeBuy: { backgroundColor: '#0ecb81' },
  activeSell: { backgroundColor: '#f6465d' },
  sideText: { color: '#fff', fontWeight: 'bold' },
  leverageContainer: { marginVertical: 10 },
  label: { color: '#848e9c', fontSize: 14, marginBottom: 10 },
  marks: { flexDirection: 'row', justifyContent: 'space-between' },
  markText: { color: '#848e9c', fontSize: 10 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  input: { backgroundColor: '#2b2f36', color: '#fff', width: '48%', padding: 12, borderRadius: 4 },
  execBtn: { marginTop: 25, padding: 18, borderRadius: 8, alignItems: 'center' },
  bgGreen: { backgroundColor: '#0ecb81' },
  bgRed: { backgroundColor: '#f6465d' },
  execText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
