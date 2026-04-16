import React from 'react';
import { View, StyleSheet, Text, SafeAreaView } from 'react-native-web'; // Web compatible version

// Note: Agar tere paas AuthProvider aur PriceContext web ke liye ready nahi hain, 
// toh abhi ke liye inhe comment kar dena taaki site crash na ho.
// import { AuthProvider } from './src/context/AuthContext';
// import { PriceProvider } from './src/context/PriceContext';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logoText}>THE ATHARVA CAPITAL</Text>
        <Text style={styles.founderText}>BY ATHARVA DARSHANWAR</Text>
      </View>
      
      <View style={styles.mainBody}>
        <Text style={styles.statusText}>World Class Virtual Trading Platform</Text>
        <Text style={styles.launchText}>System is Live on Web</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0e11', // Binance Dark Theme
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoText: {
    color: '#f0b90b', // Gold color
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  founderText: {
    color: '#848e9c',
    fontSize: 12,
    letterSpacing: 4,
    marginTop: 10,
  },
  mainBody: {
    padding: 20,
    borderRadius: 10,
    backgroundColor: '#1e2329',
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 18,
  },
  launchText: {
    color: '#02c076', // Success Green
    marginTop: 10,
    fontWeight: 'bold',
  }
});
