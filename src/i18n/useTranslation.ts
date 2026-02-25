import { useLanguageStore } from '../store/languageStore';
import { translations, TranslationKey } from './translations';

export const useTranslation = () => {
  const { language } = useLanguageStore();

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.fr[key] || key;
  };

  return { t, language };
};
