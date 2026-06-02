import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useAppTranslation } from "../../hooks/useTranslation";
import { useTheme } from "../../context/ThemeContext";
import { useAlert } from "../../context/AlertContext";
import { Lock, EyeOff, Eye, CheckCircle } from "lucide-react-native";
import InputField from "../../components/InputField";
import Button from "../../components/Button";
import { supabase } from "../../services/supabase";
import * as Linking from "expo-linking";

const ResetPasswordScreen = ({ route, navigation }) => {
  const { t, isRTL } = useAppTranslation();
  const { currentTheme } = useTheme();
  const { alert, success: showSuccess, error: showError, confirm } = useAlert();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);

  // Couleurs de base
  const primaryColor = "#015b44";
  const primaryDark = "#014537";
  const secondaryColor = "#bd9b3f";
  const secondaryDark = "#a88c37";

  const getBackgroundColor = () =>
    currentTheme === "dark" ? primaryDark : "#ffffff";

  const getTextColor = () =>
    currentTheme === "dark" ? secondaryColor : primaryColor;

  useEffect(() => {
    // Vérifier si y a un token dans le lien
    const extractTokenFromUrl = async () => {
      try {
        const url = await Linking.getInitialURL();
        console.log("URL initiale reçue:", url);

        if (url) {
          // Extraire le token depuis l'URL
          const match = url.match(/access_token=([^&]*)/);
          if (match && match[1]) {
            const token = match[1];
            console.log("Token trouvé:", token.substring(0, 20) + "...");
            setSessionToken(token);
          }
        }
      } catch (error) {
        console.error("Erreur lors de l'extraction du token:", error);
      }
    };

    extractTokenFromUrl();
  }, []);

  const validateForm = () => {
    const newErrors = {};

    if (!newPassword) {
      newErrors.password = t("password_required");
    } else if (newPassword.length < 6) {
      newErrors.password = t("password_min_length");
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t("confirm_password_required");
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = t("passwords_not_match");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResetPassword = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Vérifier s'il y a une session active
      const { data: session, error: sessionError } =
        await supabase.auth.getSession();

      if (!session?.session && !sessionToken) {
        Alert.alert(
          t("error"),
          t("session_expired"),
        );
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccess(true);
      Alert.alert(
        t("success"),
        t("reset_success_redirect"),
      );

      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });
      }, 2000);
    } catch (error) {
      console.error("Erreur reset password:", error);
      Alert.alert(
        t("error"),
        error.message || t("reset_error_message"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: getBackgroundColor(), writingDirection: isRTL ? "rtl" : "ltr" }}
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
          {/* En-tête */}
          <View style={{ alignItems: "center", marginBottom: 48 }}>
            <View
              style={{
                width: 80,
                height: 80,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: 40,
                backgroundColor: secondaryColor,
              }}
            >
              <Lock size={40} color={primaryColor} />
            </View>

            <Text
              style={{
                fontSize: 28,
                fontWeight: "bold",
                color: getTextColor(),
                textAlign: "center",
                marginBottom: 8,
                marginTop: 20,
              }}
            >
              {t("reset_password_title")}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: currentTheme === "dark" ? "#d1d5db" : "#6b7280",
                textAlign: "center",
              }}
            >
              {t("reset_password_subtitle")}
            </Text>
          </View>

          {/* Formulaire */}
          <View style={{ marginBottom: 24 }}>
            <InputField
              label={t("password")}
              value={newPassword}
              onChangeText={(value) => {
                setNewPassword(value);
                setErrors({ ...errors, password: "" });
              }}
              placeholder={t("new_password")}
              secureTextEntry={!showPassword}
              error={errors.password}
              icon={Lock}
              required
              rightIcon={showPassword ? EyeOff : Eye}
              onRightIconPress={() => setShowPassword(!showPassword)}
            />

            <InputField
              label={t("confirm_password")}
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                setErrors({ ...errors, confirmPassword: "" });
              }}
              placeholder={t("confirm_password_label")}
              secureTextEntry={!showConfirmPassword}
              error={errors.confirmPassword}
              icon={Lock}
              required
              rightIcon={showConfirmPassword ? EyeOff : Eye}
              onRightIconPress={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
            />

            {/* Message de sécurité */}
            <View
              style={{
                padding: 12,
                borderRadius: 8,
                backgroundColor:
                  currentTheme === "dark" ? "#374151" : "#f0fdf4",
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: currentTheme === "dark" ? "#10b981" : "#047857",
                  lineHeight: 18,
                }}
              >
                {t("password_security_hint")}
              </Text>
            </View>

            <Button
              title={loading ? t("loading") : t("reset_password_button")}
              onPress={handleResetPassword}
              loading={loading}
              disabled={loading}
              size="large"
              backgroundColor={
                currentTheme === "dark" ? primaryDark : primaryColor
              }
            />
          </View>

          {/* Retour à la connexion */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              marginTop: 20,
            }}
          >
            <Text
              style={{
                color: currentTheme === "dark" ? "#d1d5db" : "#6b7280",
                fontSize: 14,
              }}
            >
              {t("remember_password")}{" "}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text
                style={{
                  color: secondaryColor,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {t("sign_in_link")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ResetPasswordScreen;
