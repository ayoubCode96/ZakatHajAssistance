// screens/LoginScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from "react-native";
import { useAppTranslation } from "../../hooks/useTranslation";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Mail, Lock, Eye, EyeOff, Facebook } from "lucide-react-native";
import InputField from "../../components/InputField";
import Button from "../../components/Button";

const LoginScreen = ({ navigation }) => {
  const { t, isRTL } = useAppTranslation();
  const { signIn, signInWithGoogle, signInWithFacebook, loading } = useAuth();
  const { currentTheme } = useTheme();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  // Couleurs de base
  const primaryColor = "#015b44";
  const secondaryColor = "#bd9b3f";
  const primaryDark = "#014537";
  const secondaryDark = "#a88c37";

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = t("email_required");
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t("email_invalid");
    }

    if (!formData.password) {
      newErrors.password = t("password_required");
    } else if (formData.password.length < 6) {
      newErrors.password = t("password_min_length");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setErrors({});

    try {
      const result = await signIn(formData.email, formData.password);

      if (!result.success) {
        Alert.alert(t("error"), result.error || "Erreur de connexion");
      }
    } catch (error) {
      Alert.alert(
        t("error"),
        "Erreur réseau. Vérifiez votre connexion internet."
      );
    }
  };

  const handleGoogleLogin = async () => {
    const result = await signInWithGoogle();
    if (!result.success) {
      Alert.alert(t("error"), result.error);
    }
  };

  const handleFacebookLogin = async () => {
    const result = await signInWithFacebook();
    if (!result.success) {
      Alert.alert(t("error"), result.error);
    }
  };

  // Couleurs personnalisées
  const primaryLight = "#bd9b3f"; // doré

  // Fonctions de thème
  const getBackgroundColor = () =>
    currentTheme === "dark" ? primaryDark : "#ffffff";

  const getTextColor = () =>
    currentTheme === "dark" ? primaryLight : primaryDark;

  const getBorderColor = () =>
    currentTheme === "dark" ? primaryLight : primaryDark;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: getBackgroundColor() }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: getBackgroundColor(),
          }}
        >
          {/* Logo et En-tête */}
          <View style={{ alignItems: "center", marginBottom: 48 }}>
            {/* Logo - Remplacez par votre propre logo */}
            <View
              style={{
                width: 160,
                height: 160,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: 80,
                backgroundColor:
                  currentTheme === "dark" ? "#bd9b3f" : "#ffffff", // blanc en clair
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 5,
              }}
            >
              <Image
                source={require("../../../assets/AdIcon.png")}
                style={{
                  width: 120,
                  height: 120,
                  resizeMode: "contain",
                  tintColor: currentTheme === "dark" ? "#015b44" : undefined, // seulement en dark
                }}
              />
            </View>

            <Text
              style={{
                fontSize: 28,
                fontWeight: "bold",
                color: getTextColor(),
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              {t("app_name")}
            </Text>
            <Text
              style={{
                fontSize: 18,
                color: currentTheme === "dark" ? "#d1d5db" : "#6b7280",
                textAlign: "center",
              }}
            >
              {t("welcome")}
            </Text>
          </View>

          {/* Formulaire */}
          <View style={{ marginBottom: 24 }}>
            <InputField
              label={t("email")}
              value={formData.email}
              onChangeText={(value) =>
                setFormData({ ...formData, email: value })
              }
              placeholder="votre@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              icon={Mail}
              required
            />

            <InputField
              label={t("password")}
              value={formData.password}
              onChangeText={(value) =>
                setFormData({ ...formData, password: value })
              }
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              error={errors.password}
              icon={Lock}
              required
              rightIcon={showPassword ? EyeOff : Eye}
              onRightIconPress={() => setShowPassword(!showPassword)}
            />

            <Button
              title={loading ? t("loading") : t("sign_in")}
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              size="large"
              style={{ marginTop: 16 }}
              backgroundColor={
                currentTheme === "dark" ? primaryDark : primaryColor
              }
            />

            {/* Lien mot de passe oublié */}
            <TouchableOpacity style={{ alignSelf: "flex-end", marginTop: 12 }}>
              <Text
                style={{
                  color:
                    currentTheme === "dark" ? secondaryDark : secondaryColor,
                  fontSize: 14,
                  fontWeight: "500",
                }}
              >
                {t("forgot_password")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Séparateur */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: getBorderColor(),
              }}
            />
            <Text
              style={{
                marginHorizontal: 16,
                color: currentTheme === "dark" ? "#9ca3af" : "#6b7280",
                fontSize: 14,
              }}
            >
              {t("or_continue_with")}
            </Text>
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: getBorderColor(),
              }}
            />
          </View>

          {/* Boutons OAuth */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 32 }}>
            <TouchableOpacity
              onPress={handleGoogleLogin}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                padding: 12,
                backgroundColor:
                  currentTheme === "dark" ? "#374151" : "#f3f4f6",
                borderWidth: 1,
                borderColor: getBorderColor(),
                borderRadius: 8,
              }}
            >
              <Image
                source={{ uri: "https://www.google.com/favicon.ico" }}
                style={{ width: 20, height: 20, marginRight: 8 }}
              />
              <Text
                style={{
                  color: getTextColor(),
                  fontWeight: "500",
                }}
              >
                Google
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleFacebookLogin}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                padding: 12,
                backgroundColor:
                  currentTheme === "dark" ? "#374151" : "#f3f4f6",
                borderWidth: 1,
                borderColor: getBorderColor(),
                borderRadius: 8,
              }}
            >
              <Facebook size={20} color="#1877F2" style={{ marginRight: 8 }} />
              <Text
                style={{
                  color: getTextColor(),
                  fontWeight: "500",
                }}
              >
                Facebook
              </Text>
            </TouchableOpacity>
          </View>

          {/* Lien d'inscription */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: currentTheme === "dark" ? "#d1d5db" : "#6b7280",
                fontSize: 16,
              }}
            >
              {t("no_account")}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Register")}
              style={{ marginLeft: 8 }}
            >
              <Text
                style={{
                  color:
                    currentTheme === "dark" ? secondaryDark : secondaryColor,
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                {t("sign_up")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
