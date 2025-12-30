import { useTranslation } from 'react-i18next';
import { isRTL } from '../locales/i18n';

export const useAppTranslation = () => {
  const { t, i18n } = useTranslation();
  
  return {
    t,
    i18n,
    isRTL: isRTL(),
    currentLanguage: i18n.language,
    changeLanguage: (lng) => i18n.changeLanguage(lng)
  };
};
