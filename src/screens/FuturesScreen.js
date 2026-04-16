import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider'; // npm install @react-native-community/slider

export default function FuturesScreen() {
  const [leverage, setLeverage] = useState(10);
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');

  return (
    <View style={styles.container}>
      {/* Leverage Selector */}
      <View style={styles.leverageBox}>
        <Text style={styles.label}>Leverage: {leverage}x</Text>
        <Slider
          style={{width: '100%', height: 40}}
          minimumValue={1}
          maximumValue={125}
          step={1}
          value={leverage}
          onValueChange={setLeverage}
          minimumTrackTintColor="#f0b90b"
          maximumTrackTintColor="#2b2f36"
        />
      </View>

      {/* TP/SL Inputs */}
      <View style={styles.inputRow}>
        <TextInput 
          style={styles.smallInput} 
          placeholder="TP (Take Profit)" 
          placeholderTextColor="#848e9c"
          onChangeText={setTp}
        />
        <TextInput 
          style={styles.smallInput} 
          placeholder="SL (Stop Loss)" 
          placeholderTextColor="#848e9c"
          onChangeText={setSl}
        />
      </View>

      {/* Buy/Sell (Maker/Taker) buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.longBtn}>
          <Text style={styles.btnText}>Buy / Long</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shortBtn}>
          <Text style={styles.btnText}>Sell / Short</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e11', padding: 15 },
  leverageBox: { backgroundColor: '#1e2329', padding: 15, borderRadius: 8, marginBottom: 20 },
  label: { color: '#fff', fontWeight: 'bold' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  smallInput: { backgroundColor: '#2b2f36', color: '#fff', width: '48%', padding: 10, borderRadius: 4 },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  longBtn: { backgroundColor: '#0ecb81', flex: 1, padding: 15, marginRight: 5, borderRadius: 4, alignItems: 'center' },
  shortBtn: { backgroundColor: '#f6465d', flex: 1, padding: 15, marginLeft: 5, borderRadius: 4, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' }
});
