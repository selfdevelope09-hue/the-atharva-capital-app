import React from 'react';
import { View, Text, StyleSheet } from 'react-native-web';

export default function App() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logoText}>THE ATHARVA CAPITAL</Text>
        <Text style={styles.founderText}>ATHARVA DARSHANWAR</Text>
        <View style={styles.divider} />
        <Text style={styles.status}>System Status: <Text style={{color: '#02c076'}}>ONLINE</Text></Text>
        <Text style={styles.description}>World Class Virtual Trading Platform</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e11', justifyContent: 'center', alignItems: 'center', height: '100vh' },
  card: { backgroundColor: '#1e2329', padding: 40, borderRadius: 15, alignItems: 'center', borderWebkit: '1px solid #333' },
  logoText: { color: '#f0b90b', fontSize: 32, fontWeight: 'bold', letterSpacing: 2 },
  founderText: { color: '#848e9c', fontSize: 12, letterSpacing: 5, marginTop: 10, textTransform: 'uppercase' },
  divider: { width: 100, height: 2, backgroundColor: '#f0b90b', marginVertical: 20 },
  status: { color: '#fff', fontSize: 16, marginBottom: 10 },
  description: { color: '#848e9c', fontSize: 14 }
});
