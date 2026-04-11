import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react-native';

const MALIKI_PRIMARY = "#1a5d1a";
const MALIKI_SECONDARY = "#d4af37";
const MALIKI_DARK = "#0a2f0a";

const AlertDialog = React.forwardRef((props, ref) => {
  const { currentTheme } = useTheme();
  const [visible, setVisible] = React.useState(false);
  const [alertData, setAlertData] = React.useState({
    type: 'info', // 'info', 'success', 'error', 'warning'
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: null, style: 'default' }],
  });
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  const isDark = currentTheme === 'dark';
  const bgColor = isDark ? '#0a2f0a' : '#f0f7f0';
  const cardBg = isDark ? '#1a2a1a' : '#ffffff';
  const textColor = isDark ? '#e8edf5' : '#1a2a1a';
  const textSec = isDark ? '#a8c6a8' : '#4a6b4a';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  // Expose methods to parent component
  React.useImperativeHandle(ref, () => ({
    alert: (title, message, buttons = null) => {
      showAlert({
        type: 'info',
        title,
        message,
        buttons: buttons || [{ text: 'OK', onPress: () => close() }],
      });
    },
    success: (title, message) => {
      showAlert({
        type: 'success',
        title,
        message,
        buttons: [{ text: 'OK', onPress: () => close() }],
      });
    },
    error: (title, message) => {
      showAlert({
        type: 'error',
        title,
        message,
        buttons: [{ text: 'OK', onPress: () => close() }],
      });
    },
  }));

  const showAlert = (data) => {
    setAlertData(data);
    setVisible(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const close = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
    });
  };

  const getIcon = () => {
    switch (alertData.type) {
      case 'success':
        return <CheckCircle size={40} color="#10b981" />;
      case 'error':
        return <AlertCircle size={40} color="#dc2626" />;
      case 'warning':
        return <AlertTriangle size={40} color="#f59e0b" />;
      case 'info':
      default:
        return <Info size={40} color={MALIKI_PRIMARY} />;
    }
  };

  const getTitleColor = () => {
    switch (alertData.type) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#dc2626';
      case 'warning':
        return '#f59e0b';
      default:
        return MALIKI_PRIMARY;
    }
  };

  // Déterminer le nombre de boutons pour le layout
  const isMultiButton = alertData.buttons && alertData.buttons.length > 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <Animated.View style={[
          styles.container,
          {
            transform: [{ scale: scaleAnim }],
            opacity: scaleAnim,
          },
        ]}>
          <View style={[styles.dialog, { backgroundColor: cardBg }]}>
            {/* Close button (optional) */}
            {/* <TouchableOpacity onPress={close} style={styles.closeButton}>
              <X size={20} color={textColor} />
            </TouchableOpacity> */}

            {/* Icon */}
            <View style={styles.iconContainer}>
              {getIcon()}
            </View>

            {/* Title */}
            {alertData.title && (
              <Text style={[styles.title, { color: getTitleColor(), marginTop: 12 }]}>
                {alertData.title}
              </Text>
            )}

            {/* Message */}
            {alertData.message && (
              <Text style={[styles.message, { color: textSec, marginTop: 8 }]}>
                {alertData.message}
              </Text>
            )}

            {/* Buttons */}
            <View style={[
              styles.buttonsContainer,
              { 
                marginTop: 20,
                flexDirection: isMultiButton ? 'row' : 'column',
              }
            ]}>
              {alertData.buttons.map((button, index) => {
                const isDestructive = button.style === 'destructive';
                const isCancel = button.style === 'cancel';

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      {
                        flex: isMultiButton ? 1 : undefined,
                        backgroundColor: isDestructive
                          ? '#dc2626'
                          : isCancel
                          ? borderColor
                          : MALIKI_PRIMARY,
                        borderColor: borderColor,
                        borderWidth: isCancel ? 1 : 0,
                        marginRight: isMultiButton && index < alertData.buttons.length - 1 ? 8 : 0,
                      },
                    ]}
                    onPress={() => {
                      button.onPress?.();
                      close();
                    }}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        {
                          color: isCancel ? textColor : '#ffffff',
                          fontWeight: isDestructive || !isCancel ? '700' : '600',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {button.text || 'OK'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

AlertDialog.displayName = 'AlertDialog';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    width: '100%',
    maxWidth: 350,
  },
  dialog: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: MALIKI_PRIMARY + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
    gap: 8,
    justifyContent: 'space-between',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
});

export default AlertDialog;
