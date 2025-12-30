import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import fr from './fr.json';
import ar from './ar.json';
import en from './en.json';

const resources = {
  fr: { translation: fr },
  ar: { translation: ar },
  en: { translation: en },
};

// Détection sécurisée de la langue
const getDefaultLanguage = () => {
  try {
    // Pour Expo, on utilisera une langue par défaut pour le moment
    return 'fr';
  } catch (error) {
    return 'fr';
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getDefaultLanguage(),
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// Fonction pour changer la langue
export const changeLanguage = (lng) => {
  i18n.changeLanguage(lng);
  // Changer la direction pour l'arabe (RTL)
  if (lng === 'ar') {
    I18nManager.forceRTL(true);
  } else {
    I18nManager.forceRTL(false);
  }
};

// Fonction pour obtenir la langue actuelle
export const getCurrentLanguage = () => {
  return i18n.language;
};

// Fonction pour vérifier si c'est l'arabe (RTL)
export const isRTL = () => {
  return i18n.language === 'ar';
};

export default i18n;
