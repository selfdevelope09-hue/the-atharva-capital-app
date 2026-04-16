import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, BarChart2, Repeat, Wallet } from 'lucide-react-native';

import MarketScreen from '../screens/MarketScreen';
import TradeScreen from '../screens/TradeScreen';
import WalletScreen from '../screens/WalletScreen';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator 
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#181a20', borderTopWidth: 0 },
        tabBarActiveTintColor: '#f0b90b',
        tabBarInactiveTintColor: '#848e9c'
      }}
    >
      <Tab.Screen name="Market" component={MarketScreen} options={{ tabBarIcon: ({color}) => <BarChart2 color={color} /> }} />
      <Tab.Screen name="Trade" component={TradeScreen} options={{ tabBarIcon: ({color}) => <Repeat color={color} /> }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ tabBarIcon: ({color}) => <Wallet color={color} /> }} />
    </Tab.Navigator>
  );
}
