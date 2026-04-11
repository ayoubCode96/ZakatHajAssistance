// screens/RegisterScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useAppTranslation } from "../../hooks/useTranslation";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useAlert } from "../../context/AlertContext";
import { Mail, Lock, Eye, EyeOff, User, Facebook } from "lucide-react-native";
import InputField from "../../components/InputField";
import Button from "../../components/Button";

const RegisterScreen = ({ navigation }) => {
  const { t } = useAppTranslation();
  const { signUp, signInWithGoogle, signInWithFacebook, loading } = useAuth();
  const { currentTheme } = useTheme();
  const { alert, success, error: showError, confirm } = useAlert();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Couleurs de base
  const primaryColor = "#015b44";
  const secondaryColor = "#bd9b3f";
  const primaryDark = "#014537";
  const secondaryDark = "#a88c37";

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = t("name_required");
    }

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

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t("password_required");
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t("passwords_not_match");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setErrors({});

    try {
      const result = await signUp(
        formData.email,
        formData.password,
        formData.fullName
      );

      if (result.success) {
        success(t("success"), "Compte créé avec succès");
      } else {
        showError(
          t("error"),
          result.error || "Erreur lors de la création du compte"
        );
      }
    } catch (error) {
      showError(
        t("error"),
        "Erreur réseau. Vérifiez votre connexion internet."
      );
    }
  };

  const handleGoogleLogin = async () => {
    const result = await signInWithGoogle();
    if (!result.success) {
      showError(t("error"), result.error);
    }
  };

  const handleFacebookLogin = async () => {
    const result = await signInWithFacebook();
    if (!result.success) {
      showError(t("error"), result.error);
    }
  };

  const getBackgroundColor = () =>
    currentTheme === "dark" ? "#1f2937" : "#ffffff";

  const getTextColor = () => (currentTheme === "dark" ? "#ffffff" : "#1f2937");

  const getBorderColor = () =>
    currentTheme === "dark" ? "#374151" : "#d1d5db";

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
                              currentTheme === "dark" ? "#bd9b3f" : "#ffffff", 
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
                              tintColor: currentTheme === "dark" ? "#015b44" : undefined,
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
              {t("create_account")}
            </Text>
          </View>

          {/* Formulaire */}
          <View style={{ marginBottom: 24 }}>
            <InputField
              label={t("full_name")}
              value={formData.fullName}
              onChangeText={(value) =>
                setFormData({ ...formData, fullName: value })
              }
              placeholder={t("full_name")}
              error={errors.fullName}
              icon={User}
              required
            />

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

            <InputField
              label={t("confirm_password")}
              value={formData.confirmPassword}
              onChangeText={(value) =>
                setFormData({ ...formData, confirmPassword: value })
              }
              placeholder="••••••••"
              secureTextEntry={!showConfirmPassword}
              error={errors.confirmPassword}
              icon={Lock}
              required
              rightIcon={showConfirmPassword ? EyeOff : Eye}
              onRightIconPress={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
            />

            <Button
              title={loading ? t("loading") : t("sign_up")}
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              size="large"
              style={{ marginTop: 16 }}
              backgroundColor={
                currentTheme === "dark" ? primaryDark : primaryColor
              }
            />
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

          {/* Lien de connexion */}
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
              {t("have_account")}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Login")}
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
                {t("sign_in")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;
