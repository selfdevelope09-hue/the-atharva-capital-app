import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signUp } = useContext(AuthContext);

  const handleSignup = async () => {
    try {
      await signUp(email, password);
      Alert.alert("Success", "Welcome to The Atharva Capital! $10,000 virtual cash credited.");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>THE ATHARVA CAPITAL</Text>
      <Text style={styles.subtitle}>Create your trading account</Text>

      <TextInput 
        style={styles.input} 
        placeholder="Email Address" 
        placeholderTextColor="#848e9c"
        onChangeText={setEmail}
      />
      <TextInput 
        style={styles.input} 
        placeholder="Password" 
        placeholderTextColor="#848e9c"
        secureTextEntry
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.btn} onPress={handleSignup}>
        <Text style={styles.btnText}>Register Now</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? <Text style={{color: '#f0b90b'}}>Login</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e11', justifyContent: 'center', padding: 25 },
  logo: { color: '#f0b90b', fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: '#848e9c', textAlign: 'center', marginBottom: 40, marginTop: 5 },
  input: { backgroundColor: '#2b2f36', color: '#fff', padding: 15, borderRadius: 4, marginBottom: 15 },
  btn: { backgroundColor: '#f0b90b', padding: 15, borderRadius: 4, marginTop: 10 },
  btnText: { color: '#000', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
  link: { color: '#848e9c', textAlign: 'center', marginTop: 20 }
});
