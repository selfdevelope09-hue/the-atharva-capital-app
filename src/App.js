import React from 'react';
// Path check kar lena: screenshot ke hisaab se ye src/ folder mein hain
import { AuthProvider } from './context/AuthContext';
import { PriceProvider } from './context/PriceContext';
import AppNavigator from './navigation/AppNavigator';

/**
 * ATHARVA CAPITAL - MAIN ENTRY POINT
 * Ye file sirf contexts aur navigation ko wrap karti hai.
 * Asli screens 'src/screens/' folder ke andar hain.
 */
function App() {
  return (
    <AuthProvider>
      <PriceProvider>
        {/* Saari routing aur pages isi ke andar se handle honge */}
        <AppNavigator />
      </PriceProvider>
    </AuthProvider>
  );
}

export default App;
