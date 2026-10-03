import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { SupportedLanguage } from '../i18n/translations';

const STORAGE_KEY = 'app_language';

interface LanguageState {
  language: SupportedLanguage;
  isLoading: boolean;
  loadLanguage: () => Promise<void>;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'de',
  isLoading: true,

  loadLanguage: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored === 'en' || stored === 'de') {
        set({ language: stored, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  setLanguage: async (lang) => {
    // Switch immediately; persisting is best effort.
    set({ language: lang });
    await SecureStore.setItemAsync(STORAGE_KEY, lang).catch((error) => {
      console.error('Failed to store language:', error);
    });
  },
}));
