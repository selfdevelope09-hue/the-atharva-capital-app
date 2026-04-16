import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Context Providers (App ka dimag aur logic)
import { AuthProvider } from './src/context/AuthContext';
import { PriceProvider } from './src/context/PriceContext';

// Navigation (Screens ka flow)
import AppNavigator from './src/navigation/AppNavigator';

/**
 * THE ATHARVA CAPITAL - ENTRY POINT
 * Is file mein humne Providers ko wrap kiya hai taaki 
 * Firebase Auth aur Binance Live Prices har screen par milein.
 */

export default function App() {
  return (
    // GestureHandlerRootView zaroori hai swipe aur touch smooth rakhne ke liye
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <PriceProvider>
          {/* Binance Style Dark Theme Status Bar */}
          <StatusBar barStyle="light-content" backgroundColor="#0b0e11" />
          
          <View style={styles.container}>
            <AppNavigator />
          </View>
          
        </PriceProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0e11', // Binance signature dark background
  },
});
