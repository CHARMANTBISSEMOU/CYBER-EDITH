import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'fr' | 'en';

interface LanguageState {
  language: Language;
  isLoaded: boolean;
  setLanguage: (lang: Language) => Promise<void>;
  loadLanguage: () => Promise<void>;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'fr',
  isLoaded: false,

  setLanguage: async (lang: Language) => {
    await AsyncStorage.setItem('appLanguage', lang);
    set({ language: lang });
  },

  loadLanguage: async () => {
    try {
      const saved = await AsyncStorage.getItem('appLanguage');
      if (saved === 'fr' || saved === 'en') {
        set({ language: saved, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },
}));
