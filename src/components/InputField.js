import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useTheme } from "../context/ThemeContext";

const InputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = "default",
  error = "",
  icon: Icon,
  rightIcon: RightIcon,
  onRightIconPress,
  required = false,
  unit,
  compact = false,
  ...props
}) => {
  const { currentTheme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  // Couleurs principales
  const primaryDark = "#015b44"; // vert
  const primaryLight = "#bd9b3f"; // doré

  // Couleurs dynamiques
  const getBackgroundColor = () =>
    currentTheme === "dark" ? primaryDark : "#ffffff";
  const getTextColor = () =>
    currentTheme === "dark" ? primaryLight : primaryDark;
  const getBorderColor = () => {
    if (error) return "#ef4444";
    if (isFocused) return primaryLight;
    return currentTheme === "dark" ? primaryLight : primaryDark;
  };

  // Gestion de la saisie numérique
  const handleTextChange = (text) => {
    // Support both numeric and decimal-pad
    if (keyboardType === "numeric" || keyboardType === "decimal-pad") {
      const cleaned = text.replace(/[^0-9.]/g, "");
      const parts = cleaned.split(".");
      if (parts.length > 2) return; // Reject if more than one decimal point
      onChangeText(cleaned);
    } else {
      onChangeText(text);
    }
  };

  const p = compact ? 10 : 16;
  const fs = compact ? 14 : 16;

  return (
    <View style={{ marginBottom: compact ? 4 : 16 }}>
      {label && (
        <Text
          style={{
            color: getTextColor(),
            fontSize: compact ? 13 : 16,
            fontWeight: "500",
            marginBottom: compact ? 4 : 8,
            textAlign: "left",
          }}
        >
          {label}
          {required && <Text style={{ color: "#ef4444" }}> *</Text>}
        </Text>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 2,
          borderColor: getBorderColor(),
          borderRadius: 12,
          backgroundColor: getBackgroundColor(),
        }}
      >
        {Icon && (
          <View style={{ paddingLeft: p }}>
            <Icon
              size={compact ? 16 : 20}
              color={currentTheme === "dark" ? primaryLight : primaryDark}
            />
          </View>
        )}

        <TextInput
          style={{
            flex: 1,
            padding: p,
            fontSize: fs,
            color: getTextColor(),
            paddingLeft: Icon ? (compact ? 8 : 12) : p,
            textAlign: "left",
          }}
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={currentTheme === "dark" ? "#e0d4a0" : "#6b6b6b"}
          secureTextEntry={secureTextEntry}
          keyboardType={
            keyboardType === "numeric" || keyboardType === "decimal-pad"
              ? "decimal-pad"
              : keyboardType
          }
          onFocus={handleFocus}
          onBlur={handleBlur}
          selectionColor={primaryLight}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          multiline={false}
          returnKeyType="done"
          editable={true}
          {...props}
        />

        {unit && (
          <View style={{ paddingRight: p }}>
            <Text
              style={{
                fontSize: compact ? 12 : 14,
                color: currentTheme === "dark" ? "#e0d4a0" : "#6b6b6b",
                fontWeight: "500",
              }}
            >
              {unit}
            </Text>
          </View>
        )}

        {RightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={{ paddingRight: p }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <RightIcon
              size={20}
              color={currentTheme === "dark" ? primaryLight : primaryDark}
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text
          style={{
            color: "#ef4444",
            fontSize: 14,
            marginTop: 4,
            textAlign: "left",
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};

export default InputField;
