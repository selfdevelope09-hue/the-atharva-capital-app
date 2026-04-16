import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>THE ATHARVA CAPITAL</Text>
      <Text style={styles.welcome}>Welcome Back</Text>

      <TextInput 
        style={styles.input} 
        placeholder="Email" 
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

      <TouchableOpacity style={styles.loginBtn} onPress={() => login(email, password)}>
        <Text style={styles.btnText}>Log In</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
        <Text style={styles.linkText}>New here? <Text style={{color: '#f0b90b'}}>Register Now</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e11', justifyContent: 'center', padding: 25 },
  logo: { color: '#f0b90b', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
  welcome: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: '#2b2f36', color: '#fff', padding: 15, borderRadius: 4, marginBottom: 15 },
  loginBtn: { backgroundColor: '#f0b90b', padding: 15, borderRadius: 4, marginTop: 10 },
  btnText: { color: '#000', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
  linkText: { color: '#848e9c', textAlign: 'center', marginTop: 20 }
});
