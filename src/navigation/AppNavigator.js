import React, { useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { useAuth } from "../context/AuthContext";
import { Home, User, Calculator, Map, Settings } from "lucide-react-native";
import * as Linking from "expo-linking";

// Import des écrans
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import ResetPasswordScreen from "../screens/auth/ResetPasswordScreen";
import DashboardScreen from "../screens/DashboardScreen";
import ZakatCalculatorScreen from "../screens/ZakatCalculatorScreen";
import SettingsScreen from "../screens/SettingsScreen";
import LoadingScreen from "../components/LoadingScreen";

// Écrans temporaires
import { View, Text } from "react-native";

const TempScreen = ({ title }) => (
  <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
    <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 10 }}>
      {title}
    </Text>
    <Text style={{ fontSize: 16, color: "#666" }}>Écran en développement</Text>
  </View>
);

// Navigateurs
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack d'authentification
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen 
      name="ResetPassword" 
      component={ResetPasswordScreen}
      options={{
        animationEnabled: true,
      }}
    />
  </Stack.Navigator>
);

// Stack principal
const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      tabBarActiveTintColor: "#0d7a0dff",
      tabBarInactiveTintColor: "#abadaaff",
      headerShown: false,
    }}
  >
    <Tab.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{
        tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
      }}
    />
    <Tab.Screen
      name="Zakat"
      component={ZakatCalculatorScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Calculator color={color} size={size} />
        ),
      }}
    />
    <Tab.Screen
      name="Hajj"
      component={() => <TempScreen title="Assistant Hajj" />}
      options={{
        tabBarIcon: ({ color, size }) => <Map color={color} size={size} />,
      }}
    />
    <Tab.Screen
      name="Paramètres"
      component={SettingsScreen}
      options={{
        tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
      }}
    />
  </Tab.Navigator>
);

// Navigateur principal
const AppNavigator = () => {
  const { user, loading } = useAuth();

  // Afficher l'écran de chargement amélioré
  if (loading) {
    return <LoadingScreen message="Initialisation de l'authentification..." />;
  }

  return user ? <MainTabs /> : <AuthStack />;
};

export default AppNavigator;
