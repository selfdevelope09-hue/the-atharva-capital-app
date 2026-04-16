import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { executeTrade } from '../firebase/TradeLogic';

export default function TradeScreen() {
  const { user } = useContext(AuthContext);
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('0.00');

  useEffect(() => {
    // Real-time BTC Price Fetching
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setPrice(parseFloat(data.c).toFixed(2));
    };
    return () => ws.close();
  }, []);

  const handleBuy = async () => {
    if (!amount || isNaN(amount)) return alert("Enter valid amount");
    const res = await executeTrade(user.uid, 'BTCUSDT', parseFloat(price), parseFloat(amount), 'BUY');
    alert(res.message);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BTC/USDT</Text>
        <Text style={styles.livePrice}>${price}</Text>
      </View>

      <View style={styles.tradeBox}>
        <View style={styles.sideBar}>
          <Text style={styles.redText}>64250.10</Text>
          <Text style={styles.redText}>64249.50</Text>
          <Text style={styles.priceMid}>{price}</Text>
          <Text style={styles.greenText}>64245.20</Text>
          <Text style={styles.greenText}>64244.00</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.tabs}>
            <View style={[styles.tab, {backgroundColor: '#0ecb81'}]}><Text style={styles.tabText}>Buy</Text></View>
            <View style={styles.tab}><Text style={styles.tabText}>Sell</Text></View>
          </View>
          
          <TextInput style={styles.input} value={`Price: ${price}`} editable={false} />
          <TextInput 
            style={styles.input} 
            placeholder="Amount (USDT)" 
            placeholderTextColor="#848e9c" 
            keyboardType="numeric"
            onChangeText={setAmount}
          />
          
          <Text style={styles.avbl}>Avbl: {user?.virtualBalance?.toFixed(2)} USDT</Text>
          
          <TouchableOpacity style={styles.buyBtn} onPress={handleBuy}>
            <Text style={styles.buyBtnText}>Buy BTC</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e11', padding: 15 },
  header: { marginBottom: 20, marginTop: 40 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  livePrice: { color: '#0ecb81', fontSize: 18, fontWeight: '600' },
  tradeBox: { flexDirection: 'row', justifyContent: 'space-between' },
  sideBar: { width: '35%' },
  redText: { color: '#f6465d', fontSize: 12, marginBottom: 5 },
  greenText: { color: '#0ecb81', fontSize: 12, marginBottom: 5 },
  priceMid: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginVertical: 10 },
  form: { width: '60%' },
  tabs: { flexDirection: 'row', backgroundColor: '#2b2f36', borderRadius: 4, marginBottom: 15 },
  tab: { flex: 1, padding: 8, alignItems: 'center', borderRadius: 4 },
  tabText: { color: '#fff', fontWeight: 'bold' },
  input: { backgroundColor: '#2b2f36', color: '#fff', padding: 12, borderRadius: 4, marginBottom: 10 },
  avbl: { color: '#848e9c', fontSize: 12, marginBottom: 10 },
  buyBtn: { backgroundColor: '#0ecb81', padding: 15, borderRadius: 4, alignItems: 'center' },
  buyBtnText: { color: '#fff', fontWeight: 'bold' }
});
