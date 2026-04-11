import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { CurrencyProvider } from './src/context/CurrencyContext';
import { AlertProvider } from './src/context/AlertContext';
import AppNavigator from './src/navigation/AppNavigator';
import './src/locales/i18n'; // Import de la configuration i18n

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <CurrencyProvider>
          <AuthProvider>
            <AlertProvider>
              <NavigationContainer>
                <StatusBar style="auto" />
                <AppNavigator />
              </NavigationContainer>
            </AlertProvider>
          </AuthProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}