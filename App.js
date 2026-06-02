import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { CurrencyProvider } from './src/context/CurrencyContext';
import { AlertProvider } from './src/context/AlertContext';
import AppNavigator from './src/navigation/AppNavigator';
import './src/locales/i18n';

const linking = {
  prefixes: [Linking.createURL('/'), 'zakati://', 'exp://'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
          ResetPassword: 'password-reset',
        },
      },
      Main: {
        screens: {
          Dashboard: 'dashboard',
          Zakat: 'zakat',
          Settings: 'settings',
        },
      },
    },
  },
};

export default function App() {
  const navigationRef = useRef(null);

  useEffect(() => {
    const handleDeepLink = (event) => {
      const url = event?.url || event;
      if (url && url.includes('oauth-callback')) {
        console.log('[DeepLink] OAuth callback reçu:', url);
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription?.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <CurrencyProvider>
          <AuthProvider>
            <AlertProvider>
              <NavigationContainer linking={linking} ref={navigationRef}>
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