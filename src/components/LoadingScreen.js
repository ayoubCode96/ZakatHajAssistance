import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Calculator } from 'lucide-react-native';

const LoadingScreen = ({ message = "Chargement..." }) => {
  const { currentTheme } = useTheme();

  const getBackgroundColor = () => 
    currentTheme === 'dark' ? '#1f2937' : '#f8fafc';

  const getTextColor = () =>
    currentTheme === 'dark' ? '#ffffff' : '#1f2937';

  const getSecondaryTextColor = () =>
    currentTheme === 'dark' ? '#d1d5db' : '#6b7280';

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      <View style={styles.content}>
        <Calculator size={48} color="#3b82f6" />
        <Text style={[styles.title, { color: getTextColor() }]}>
          Zakati & Hajj Assistant
        </Text>
        <ActivityIndicator size="large" color="#3b82f6" style={styles.spinner} />
        <Text style={[styles.message, { color: getSecondaryTextColor() }]}>
          {message}
        </Text>
        <Text style={[styles.hint, { color: getSecondaryTextColor() }]}>
          Initialisation de l'application...
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default LoadingScreen;
