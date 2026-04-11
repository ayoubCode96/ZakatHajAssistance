import React, { createContext, useContext, useRef } from 'react';
import AlertDialog from '../components/AlertDialog';
import { useAppTranslation } from '../hooks/useTranslation';

const AlertContext = createContext();

export const AlertProvider = ({ children }) => {
  const alertRef = useRef();
  const { t } = useAppTranslation();

  const alert = (title, message, buttons = null) => {
    alertRef.current?.alert(title, message, buttons);
  };

  const confirm = (title, message, onConfirm, onCancel = null) => {
    const buttons = [
      { text: t('cancel'), onPress: onCancel, style: 'cancel' },
      { text: t('ok'), onPress: onConfirm, style: 'destructive' },
    ];
    alertRef.current?.alert(title, message, buttons);
  };

  const success = (title, message = '') => {
    alertRef.current?.success(title, message);
  };

  const error = (title, message = '') => {
    alertRef.current?.error(title, message);
  };

  const value = {
    alert,
    confirm,
    success,
    error,
  };

  return (
    <AlertContext.Provider value={value}>
      {children}
      <AlertDialog ref={alertRef} />
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert doit être utilisé dans un AlertProvider');
  }
  return context;
};
