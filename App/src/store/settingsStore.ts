import { create } from 'zustand';
import {
  TranslationRouter,
  type TranslationProvider,
} from '../infrastructure/translation/TranslationRouter';
import { DeepLClient } from '../infrastructure/translation/DeepLClient';
import { MyMemoryClient } from '../infrastructure/translation/MyMemoryClient';

interface SettingsState {
  provider: TranslationProvider;
  hasDeepLKey: boolean;
  hasMyMemoryKey: boolean;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  setProvider: (provider: TranslationProvider) => Promise<void>;
  saveDeepLKey: (key: string) => Promise<void>;
  deleteDeepLKey: () => Promise<void>;
  saveMyMemoryKey: (key: string) => Promise<void>;
  deleteMyMemoryKey: () => Promise<void>;
}

const router = new TranslationRouter();
const deepLClient = new DeepLClient();
const myMemoryClient = new MyMemoryClient();

export const useSettingsStore = create<SettingsState>((set) => ({
  provider: 'mymemory',
  hasDeepLKey: false,
  hasMyMemoryKey: false,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const provider = await router.getProvider();
      const [deeplKey, myMemoryKey] = await Promise.all([
        deepLClient.getApiKey(),
        myMemoryClient.getApiKey(),
      ]);
      set({
        provider,
        hasDeepLKey: !!deeplKey,
        hasMyMemoryKey: !!myMemoryKey,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  setProvider: async (provider) => {
    await router.setProvider(provider);
    set({ provider });
  },

  saveDeepLKey: async (key) => {
    set({ isLoading: true });
    try {
      await deepLClient.saveApiKey(key);
      set({ hasDeepLKey: true });
    } catch (error) {
      console.error('Failed to save DeepL key:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  deleteDeepLKey: async () => {
    set({ isLoading: true });
    try {
      await deepLClient.deleteApiKey();
      set({ hasDeepLKey: false });
    } catch (error) {
      console.error('Failed to delete DeepL key:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  saveMyMemoryKey: async (key) => {
    set({ isLoading: true });
    try {
      await myMemoryClient.saveApiKey(key);
      set({ hasMyMemoryKey: true });
    } catch (error) {
      console.error('Failed to save MyMemory key:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  deleteMyMemoryKey: async () => {
    set({ isLoading: true });
    try {
      await myMemoryClient.deleteApiKey();
      set({ hasMyMemoryKey: false });
    } catch (error) {
      console.error('Failed to delete MyMemory key:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
