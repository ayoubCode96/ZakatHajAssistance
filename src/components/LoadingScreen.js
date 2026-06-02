import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useAppTranslation } from "../hooks/useTranslation";
import { Calculator } from "lucide-react-native";

const fallbackT = (key) => {
  const msgs = { loading: "Chargement...", app_name: "Zakati & Hajj Assistant", app_initializing: "Initialisation de l'application..." };
  return msgs[key] || key;
};

const LoadingScreen = ({ message }) => {
  const { currentTheme } = useTheme();
  let t, isRTL;
  try {
    ({ t, isRTL } = useAppTranslation());
  } catch (e) {
    t = fallbackT;
    isRTL = false;
  }
  const displayMessage = message || t("loading");

  const getBackgroundColor = () =>
    currentTheme === "dark" ? "#1f2937" : "#f8fafc";

  const getTextColor = () => (currentTheme === "dark" ? "#ffffff" : "#1f2937");

  const getSecondaryTextColor = () =>
    currentTheme === "dark" ? "#d1d5db" : "#6b7280";

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor(), writingDirection: isRTL ? "rtl" : "ltr" }]}>
      <View style={styles.content}>
        <Calculator size={48} color="#3b82f6" />
        <Text style={[styles.title, { color: getTextColor() }]}>
          {t("app_name")}
        </Text>
        <ActivityIndicator
          size="large"
          color="#3b82f6"
          style={styles.spinner}
        />
        <Text style={[styles.message, { color: getSecondaryTextColor() }]}>
          {displayMessage}
        </Text>
        <Text style={[styles.hint, { color: getSecondaryTextColor() }]}>
          {t("app_initializing")}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    padding: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 32,
    textAlign: "center",
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
});

export default LoadingScreen;
