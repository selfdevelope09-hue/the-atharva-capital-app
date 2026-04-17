import React from 'react';
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { View, Text, StyleSheet } from 'react-native-web';

// Components
const Home = () => (
  <View style={styles.card}>
    <Text style={styles.logoText}>THE ATHARVA CAPITAL</Text>
    <Text style={styles.status}>SYSTEM ONLINE ✅</Text>
    <Link to="/dashboard" style={styles.button}>
      <Text style={styles.buttonText}>OPEN DASHBOARD</Text>
    </Link>
  </View>
);

const Dashboard = () => (
  <View style={styles.card}>
    <Text style={styles.logoText}>DASHBOARD</Text>
    <Text style={styles.status}>Trading Terminal Active</Text>
    <Link to="/" style={styles.button}>
      <Text style={styles.buttonText}>BACK TO HOME</Text>
    </Link>
  </View>
);

export default function App() {
  return (
    <Router>
      <View style={styles.container}>
        <Routes>
          {/* Main Home Route */}
          <Route path="/" element={<Home />} />
          
          {/* Dashboard Route */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* 🚨 Yeh sabse zaroori hai: Agar kuch na mile toh Home pe bhejo */}
          <Route path="*" element={<Home />} />
        </Routes>
      </View>
    </Router>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0b0e11', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    width: '100vw' 
  },
  card: { 
    backgroundColor: '#1e2329', 
    padding: 40, 
    borderRadius: 15, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#333' 
  },
  logoText: { color: '#f0b90b', fontSize: 32, fontWeight: 'bold' },
  status: { color: '#fff', fontSize: 16, marginVertical: 20 },
  button: { 
    marginTop: 20, 
    padding: 15, 
    backgroundColor: '#f0b90b', 
    borderRadius: 8, 
    textDecoration: 'none' 
  },
  buttonText: { color: '#000', fontWeight: 'bold' }
});
