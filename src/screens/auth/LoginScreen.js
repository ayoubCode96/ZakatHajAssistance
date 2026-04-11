// screens/LoginScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  StyleSheet,
} from "react-native";
import { useAppTranslation } from "../../hooks/useTranslation";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useAlert } from "../../context/AlertContext";
import { Mail, Lock, Eye, EyeOff, Facebook, X } from "lucide-react-native";
import InputField from "../../components/InputField";
import Button from "../../components/Button";
import { supabase } from "../../services/supabase";
import { resetPasswordService } from "../../services/resetPasswordService";

const LoginScreen = ({ navigation }) => {
  const { t, isRTL } = useAppTranslation();
  const { signIn, signInWithGoogle, signInWithFacebook, loading } = useAuth();
  const { currentTheme } = useTheme();
  const { alert, success, error: showError, confirm } = useAlert();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1); // 1: email, 2: code, 3: password
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordCode, setForgotPasswordCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotPasswordErrors, setForgotPasswordErrors] = useState({});
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null); // Code stocké côté client pour demo

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
        showError(t("error"), result.error || "Erreur de connexion");
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

  const validateForgotPasswordForm = () => {
    const newErrors = {};

    if (!forgotPasswordEmail.trim()) {
      newErrors.email = t("email_required");
    } else if (!/\S+@\S+\.\S+/.test(forgotPasswordEmail)) {
      newErrors.email = t("email_invalid");
    }

    setForgotPasswordErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendCode = async () => {
    if (!validateForgotPasswordForm()) return;

    setForgotPasswordLoading(true);
    try {
      console.log("📧 Appel du service sendResetCode pour:", forgotPasswordEmail);
      
      // Appeler le service qui va: vérifier email + générer code + insérer en BDD
      const result = await resetPasswordService.sendResetCode(forgotPasswordEmail);

      if (!result.success) {
        throw new Error(result.error || "Erreur lors de l'envoi du code");
      }

      console.log("✅ Code généré et stocké en BDD:", result.debug_code);
      setGeneratedCode(result.debug_code);

      success(
        t("success"),
        `Un code de vérification a été envoyé à ${forgotPasswordEmail}`
      );

      setForgotPasswordStep(2);
      setForgotPasswordErrors({});
    } catch (error) {
      console.error("❌ Erreur handleSendCode:", error);
      showError(
        t("error"),
        error.message || "Erreur lors de l'envoi du code. Vérifiez votre email."
      );
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const newErrors = {};

    if (!forgotPasswordCode.trim()) {
      newErrors.code = "Le code de vérification est requis";
    }

    setForgotPasswordErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setForgotPasswordLoading(true);
    try {
      // Vérifier le code en base de données
      const result = await resetPasswordService.verifyCode(
        forgotPasswordEmail,
        forgotPasswordCode
      );

      if (!result.success) {
        showError(t("error"), result.error || "Code invalide ou expiré");
        setForgotPasswordLoading(false);
        return;
      }

      // Code vérifié, aller à l'étape 3
      setForgotPasswordStep(3);
      setForgotPasswordErrors({});
    } catch (error) {
      showError(t("error"), "Erreur lors de la vérification du code");
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    const newErrors = {};

    if (!newPassword) {
      newErrors.password = t("password_required");
    } else if (newPassword.length < 6) {
      newErrors.password = t("password_min_length");
    }

    if (!confirmNewPassword) {
      newErrors.confirmPassword = t("confirm_password") + " requis";
    } else if (newPassword !== confirmNewPassword) {
      newErrors.confirmPassword = t("passwords_not_match");
    }

    setForgotPasswordErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    setForgotPasswordLoading(true);
    try {
      // Appeler le service qui va utiliser la fonction Edge
      const result = await resetPasswordService.resetPassword(
        forgotPasswordEmail,
        newPassword,
        forgotPasswordCode
      );

      if (!result.success) {
        throw new Error(result.error || "Erreur lors de la réinitialisation");
      }

      success(
        t("success"),
        "Votre mot de passe a été réinitialisé avec succès!"
      );

      // Réinitialiser le modal
      setShowForgotPasswordModal(false);
      setForgotPasswordStep(1);
      setForgotPasswordEmail("");
      setForgotPasswordCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setGeneratedCode(null);
      setForgotPasswordErrors({});
    } catch (error) {
      showError(
        t("error"),
        error.message ||
          "Erreur lors de la réinitialisation du mot de passe"
      );
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPasswordModal(false);
    setForgotPasswordStep(1);
    setForgotPasswordEmail("");
    setForgotPasswordCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setGeneratedCode(null);
    setForgotPasswordErrors({});
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
            <TouchableOpacity 
              style={{ alignSelf: "flex-end", marginTop: 12 }}
              onPress={() => setShowForgotPasswordModal(true)}
            >
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

            {/* <TouchableOpacity
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
            </TouchableOpacity> */}
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

      {/* Modal - Mot de passe oublié */}
      <Modal
        visible={showForgotPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeForgotPasswordModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor:
                  currentTheme === "dark" ? primaryDark : "#ffffff",
              },
            ]}
          >
            {/* Bouton fermeture */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeForgotPasswordModal}
            >
              <X size={24} color={getTextColor()} />
            </TouchableOpacity>

            {/* ÉTAPE 1: Email */}
            {forgotPasswordStep === 1 && (
              <>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: getTextColor() },
                  ]}
                >
                  Réinitialiser le mot de passe
                </Text>

                <Text
                  style={[
                    styles.modalDescription,
                    {
                      color:
                        currentTheme === "dark" ? "#d1d5db" : "#6b7280",
                    },
                  ]}
                >
                  Entrez votre adresse email pour recevoir un code de vérification.
                </Text>

                <View style={{ marginBottom: 20 }}>
                  <InputField
                    label={t("email")}
                    value={forgotPasswordEmail}
                    onChangeText={(value) => {
                      setForgotPasswordEmail(value);
                      setForgotPasswordErrors({});
                    }}
                    placeholder="votre@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={forgotPasswordErrors.email}
                    icon={Mail}
                  />
                </View>

                <View style={{ gap: 12 }}>
                  <Button
                    title={
                      forgotPasswordLoading
                        ? t("loading")
                        : "Envoyer le code"
                    }
                    onPress={handleSendCode}
                    loading={forgotPasswordLoading}
                    disabled={forgotPasswordLoading}
                    size="large"
                    backgroundColor={
                      currentTheme === "dark" ? primaryDark : primaryColor
                    }
                  />
                  <Button
                    title="Annuler"
                    onPress={closeForgotPasswordModal}
                    size="large"
                    backgroundColor={
                      currentTheme === "dark" ? "#374151" : "#e5e7eb"
                    }
                    textColor={getTextColor()}
                  />
                </View>
              </>
            )}

            {/* ÉTAPE 2: Code de vérification */}
            {forgotPasswordStep === 2 && (
              <>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: getTextColor() },
                  ]}
                >
                  Vérifier le code
                </Text>

                <Text
                  style={[
                    styles.modalDescription,
                    {
                      color:
                        currentTheme === "dark" ? "#d1d5db" : "#6b7280",
                    },
                  ]}
                >
                  Un code de vérification a été envoyé à {forgotPasswordEmail}
                </Text>

                <View style={{ marginBottom: 20 }}>
                  <InputField
                    label="Code de vérification"
                    value={forgotPasswordCode}
                    onChangeText={(value) => {
                      setForgotPasswordCode(value);
                      setForgotPasswordErrors({});
                    }}
                    placeholder="000000"
                    keyboardType="number-pad"
                    maxLength={6}
                    error={forgotPasswordErrors.code}
                  />
                </View>

                <View style={{ gap: 12 }}>
                  <Button
                    title={
                      forgotPasswordLoading
                        ? t("loading")
                        : "Vérifier le code"
                    }
                    onPress={handleVerifyCode}
                    loading={forgotPasswordLoading}
                    disabled={forgotPasswordLoading}
                    size="large"
                    backgroundColor={
                      currentTheme === "dark" ? primaryDark : primaryColor
                    }
                  />
                  <Button
                    title="Retour"
                    onPress={() => {
                      setForgotPasswordStep(1);
                      setForgotPasswordCode("");
                      setForgotPasswordErrors({});
                    }}
                    size="large"
                    backgroundColor={
                      currentTheme === "dark" ? "#374151" : "#e5e7eb"
                    }
                    textColor={getTextColor()}
                  />
                </View>
              </>
            )}

            {/* ÉTAPE 3: Nouveau mot de passe */}
            {forgotPasswordStep === 3 && (
              <>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: getTextColor() },
                  ]}
                >
                  Nouveau mot de passe
                </Text>

                <Text
                  style={[
                    styles.modalDescription,
                    {
                      color:
                        currentTheme === "dark" ? "#d1d5db" : "#6b7280",
                    },
                  ]}
                >
                  Entrez votre nouveau mot de passe
                </Text>

                <View style={{ marginBottom: 20 }}>
                  <InputField
                    label={t("password")}
                    value={newPassword}
                    onChangeText={(value) => {
                      setNewPassword(value);
                      setForgotPasswordErrors({});
                    }}
                    placeholder="Nouveau mot de passe"
                    secureTextEntry={!showNewPassword}
                    error={forgotPasswordErrors.password}
                    icon={Lock}
                    rightIcon={showNewPassword ? EyeOff : Eye}
                    onRightIconPress={() =>
                      setShowNewPassword(!showNewPassword)
                    }
                  />

                  <InputField
                    label={t("confirm_password")}
                    value={confirmNewPassword}
                    onChangeText={(value) => {
                      setConfirmNewPassword(value);
                      setForgotPasswordErrors({});
                    }}
                    placeholder="Confirmer le mot de passe"
                    secureTextEntry={!showConfirmPassword}
                    error={forgotPasswordErrors.confirmPassword}
                    icon={Lock}
                    rightIcon={showConfirmPassword ? EyeOff : Eye}
                    onRightIconPress={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                  />
                </View>

                <View style={{ gap: 12 }}>
                  <Button
                    title={
                      forgotPasswordLoading
                        ? t("loading")
                        : "Réinitialiser le mot de passe"
                    }
                    onPress={handleUpdatePassword}
                    loading={forgotPasswordLoading}
                    disabled={forgotPasswordLoading}
                    size="large"
                    backgroundColor={
                      currentTheme === "dark" ? primaryDark : primaryColor
                    }
                  />
                  <Button
                    title="Annuler"
                    onPress={closeForgotPasswordModal}
                    size="large"
                    backgroundColor={
                      currentTheme === "dark" ? "#374151" : "#e5e7eb"
                    }
                    textColor={getTextColor()}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    marginTop: 20,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
});

export default LoginScreen;
