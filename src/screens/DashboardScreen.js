    import React from "react";
    import {
      View,
      Text,
      ScrollView,
      TouchableOpacity,
      StyleSheet,
    } from "react-native";
    import { useAppTranslation } from "../hooks/useTranslation";
    import { useTheme } from "../context/ThemeContext";
    import { useAuth } from "../context/AuthContext";
    import { Calculator, Map, User, LogOut, Settings } from "lucide-react-native";
    import Button from "../components/Button";


    const DashboardScreen = ({ navigation }) => {
      const { t, currentLanguage, changeLanguage } = useAppTranslation();
      const { currentTheme } = useTheme();
      const { user, signOut, loading } = useAuth();

      const getBackgroundColor = () =>
        currentTheme === "dark" ? "#1f2937" : "#f8fafc";

      const getCardColor = () => (currentTheme === "dark" ? "#374151" : "#ffffff");

      const getTextColor = () => (currentTheme === "dark" ? "#ffffff" : "#1f2937");

      const getSecondaryTextColor = () =>
        currentTheme === "dark" ? "#d1d5db" : "#6b7280";

      const FeatureCard = ({ title, description, icon: Icon, onPress, color }) => (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: getCardColor() }]}
          onPress={onPress}
        >
          <View style={[styles.iconContainer, { backgroundColor: color }]}>
            <Icon size={24} color="#ffffff" />
          </View>
          <Text style={[styles.cardTitle, { color: getTextColor() }]}>{title}</Text>
          <Text
            style={[styles.cardDescription, { color: getSecondaryTextColor() }]}
          >
            {description}
          </Text>
        </TouchableOpacity>
      );

    const handleLogout = async () => {
      try {
        const result = await signOut();
        if (result.success) {
          console.log("Déconnexion réussie");
        }
      } catch (error) {
        console.error("Erreur lors de la déconnexion:", error);
      }
    };

      const toggleLanguage = () => {
        const newLang =
          currentLanguage === "fr" ? "ar" : currentLanguage === "ar" ? "en" : "fr";
        changeLanguage(newLang);
      };

      return (
        <ScrollView
          style={[styles.container, { backgroundColor: getBackgroundColor() }]}
        >
          {/* En-tête */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.welcome, { color: getTextColor() }]}>
                {t("welcome")}, {user?.name || "Utilisateur"}
              </Text>
              <Text style={[styles.subtitle, { color: getSecondaryTextColor() }]}>
                {t("app_name")}
              </Text>
            </View>
            <TouchableOpacity onPress={handleLogout}>
              <LogOut size={24} color={getSecondaryTextColor()} />
            </TouchableOpacity>
          </View>

          {/* Cartes de fonctionnalités */}
          <View style={styles.featuresGrid}>
            <FeatureCard
              title={t("zakat_calculator")}
              description="Calculez votre Zakat facilement"
              icon={Calculator}
              color="#3b82f6"
              onPress={() => navigation.navigate("Zakat")}
            />

            <FeatureCard
              title={t("hajj_assistant")}
              description="Guide complet pour votre Hajj"
              icon={Map}
              color="#10b981"
              onPress={() => navigation.navigate("Hajj")}
            />

            <FeatureCard
              title={t("profile")}
              description="Gérez votre profil"
              icon={User}
              color="#8b5cf6"
              onPress={() => navigation.navigate("Profil")}
            />

            <FeatureCard
              title={t("settings")}
              description="Paramètres de l'application"
              icon={Settings}
              color="#f59e0b"
              onPress={() => navigation.navigate("Paramètres")}
            />
          </View>

          {/* Section statistiques */}
          <View style={[styles.statsSection, { backgroundColor: getCardColor() }]}>
            <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
              Statistiques
            </Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: "#3b82f6" }]}>0</Text>
                <Text
                  style={[styles.statLabel, { color: getSecondaryTextColor() }]}
                >
                  Calculs Zakat
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: "#10b981" }]}>0</Text>
                <Text
                  style={[styles.statLabel, { color: getSecondaryTextColor() }]}
                >
                  Rappels
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: "#8b5cf6" }]}>0</Text>
                <Text
                  style={[styles.statLabel, { color: getSecondaryTextColor() }]}
                >
                  Progrès Hajj
                </Text>
              </View>
            </View>
          </View>

          {/* Bouton changement de langue */}
          <View style={styles.languageSection}>
            <Button
              title={`Langue: ${currentLanguage.toUpperCase()}`}
              onPress={toggleLanguage}
              variant="outline"
              style={styles.languageButton}
            />
          </View>
        </ScrollView>
      );
    };

    const styles = StyleSheet.create({
      container: {
        flex: 1,
        padding: 16,
      },
      header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 32,
        marginTop: 16,
      },
      welcome: {
        fontSize: 24,
        fontWeight: "bold",
      },
      subtitle: {
        fontSize: 16,
        marginTop: 4,
      },
      featuresGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginBottom: 24,
      },
      card: {
        width: "48%",
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
      iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
      },
      cardTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
      },
      cardDescription: {
        fontSize: 12,
      },
      statsSection: {
        padding: 20,
        borderRadius: 12,
        marginBottom: 24,
      },
      sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 16,
      },
      statsGrid: {
        flexDirection: "row",
        justifyContent: "space-around",
      },
      statItem: {
        alignItems: "center",
      },
      statNumber: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 4,
      },
      statLabel: {
        fontSize: 12,
        textAlign: "center",
      },
      languageSection: {
        alignItems: "center",
        marginBottom: 24,
      },
      languageButton: {
        width: "60%",
      },
    });

    export default DashboardScreen;
    