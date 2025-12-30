import React from "react";
import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { useTheme } from "../context/ThemeContext";

const Button = ({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  loading = false,
  disabled = false,
  style = {},
  ...props
}) => {
  const { currentTheme } = useTheme();

  // 🎨 Couleurs principales
  const primaryDark = "#015b44"; // vert
  const primaryLight = "#bd9b3f"; // doré

  const getVariantStyles = () => {
    const baseStyles = {
      borderRadius: 12,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      opacity: disabled ? 0.6 : 1,
    };

    const sizeStyles = {
      small: { paddingVertical: 8, paddingHorizontal: 16 },
      medium: { paddingVertical: 12, paddingHorizontal: 24 },
      large: { paddingVertical: 16, paddingHorizontal: 32 },
    };

    if (variant === "primary") {
      return {
        ...baseStyles,
        ...sizeStyles[size],
        backgroundColor: disabled
          ? "#9ca3af"
          : currentTheme === "dark"
          ? primaryLight
          : primaryDark,
      };
    }

    if (variant === "secondary") {
      return {
        ...baseStyles,
        ...sizeStyles[size],
        backgroundColor: currentTheme === "dark" ? primaryDark : primaryLight,
      };
    }

    if (variant === "outline") {
      return {
        ...baseStyles,
        ...sizeStyles[size],
        backgroundColor: "transparent",
        borderWidth: 2,
        borderColor: currentTheme === "dark" ? primaryLight : primaryDark,
      };
    }

    return { ...baseStyles, ...sizeStyles[size] };
  };

  const getTextStyles = () => {
    const sizeStyles = {
      small: { fontSize: 14 },
      medium: { fontSize: 16 },
      large: { fontSize: 18 },
    };

    if (variant === "primary") {
      return {
        ...sizeStyles[size],
        color: currentTheme === "dark" ? primaryDark : primaryLight,
        fontWeight: "700",
      };
    }

    if (variant === "secondary") {
      return {
        ...sizeStyles[size],
        color: currentTheme === "dark" ? primaryLight : primaryDark,
        fontWeight: "700",
      };
    }

    if (variant === "outline") {
      return {
        ...sizeStyles[size],
        color: currentTheme === "dark" ? primaryLight : primaryDark,
        fontWeight: "700",
      };
    }

    return {
      ...sizeStyles[size],
      color: currentTheme === "dark" ? "#ffffff" : "#1f2937",
      fontWeight: "700",
    };
  };

  return (
    <TouchableOpacity
      style={[getVariantStyles(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? primaryLight : primaryDark}
          style={{ marginRight: 8 }}
        />
      )}
      <Text style={getTextStyles()}>{title}</Text>
    </TouchableOpacity>
  );
};

export default Button;
