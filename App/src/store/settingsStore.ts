import { create } from 'zustand';
import {
  TranslationRouter,
  type TranslationProvider,
} from '../infrastructure/translation/TranslationRouter';
import { DeepLClient } from '../infrastructure/translation/DeepLClient';
import { MyMemoryClient } from '../infrastructure/translation/MyMemoryClient';
import { UsdaClient } from '../infrastructure/api/UsdaClient';

interface SettingsState {
  provider: TranslationProvider;
  hasDeepLKey: boolean;
  hasMyMemoryKey: boolean;
  hasUsdaKey: boolean;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  setProvider: (provider: TranslationProvider) => Promise<void>;
  saveDeepLKey: (key: string) => Promise<boolean>;
  deleteDeepLKey: () => Promise<boolean>;
  saveMyMemoryKey: (key: string) => Promise<boolean>;
  deleteMyMemoryKey: () => Promise<boolean>;
  saveUsdaKey: (key: string) => Promise<boolean>;
  deleteUsdaKey: () => Promise<boolean>;
}

const router = new TranslationRouter();
const deepLClient = new DeepLClient();
const myMemoryClient = new MyMemoryClient();
const usdaClient = new UsdaClient();

export const useSettingsStore = create<SettingsState>((set) => ({
  provider: 'mymemory',
  hasDeepLKey: false,
  hasMyMemoryKey: false,
  hasUsdaKey: false,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const provider = await router.getProvider();
      const [deeplKey, myMemoryKey, usdaKey] = await Promise.all([
        deepLClient.getApiKey(),
        myMemoryClient.getApiKey(),
        usdaClient.getApiKey(),
      ]);
      set({
        provider,
        hasDeepLKey: !!deeplKey,
        hasMyMemoryKey: !!myMemoryKey,
        hasUsdaKey: !!usdaKey,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  setProvider: async (provider) => {
    set({ provider });
    await router.setProvider(provider).catch((error) => {
      console.error('Failed to store translation provider:', error);
    });
  },

  saveDeepLKey: async (key) => {
    set({ isLoading: true });
    try {
      await deepLClient.saveApiKey(key);
      set({ hasDeepLKey: true });
      return true;
    } catch (error) {
      console.error('Failed to save DeepL key:', error);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteDeepLKey: async () => {
    set({ isLoading: true });
    try {
      await deepLClient.deleteApiKey();
      set({ hasDeepLKey: false });
      return true;
    } catch (error) {
      console.error('Failed to delete DeepL key:', error);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  saveMyMemoryKey: async (key) => {
    set({ isLoading: true });
    try {
      await myMemoryClient.saveApiKey(key);
      set({ hasMyMemoryKey: true });
      return true;
    } catch (error) {
      console.error('Failed to save MyMemory key:', error);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteMyMemoryKey: async () => {
    set({ isLoading: true });
    try {
      await myMemoryClient.deleteApiKey();
      set({ hasMyMemoryKey: false });
      return true;
    } catch (error) {
      console.error('Failed to delete MyMemory key:', error);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  saveUsdaKey: async (key) => {
    set({ isLoading: true });
    try {
      await usdaClient.saveApiKey(key);
      set({ hasUsdaKey: true });
      return true;
    } catch (error) {
      console.error('Failed to save USDA key:', error);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteUsdaKey: async () => {
    set({ isLoading: true });
    try {
      await usdaClient.deleteApiKey();
      set({ hasUsdaKey: false });
      return true;
    } catch (error) {
      console.error('Failed to delete USDA key:', error);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
}));
