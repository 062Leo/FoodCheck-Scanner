import * as SecureStore from 'expo-secure-store';
import type { Translator } from '../../domain/translation/Translator';
import { DeepLClient } from './DeepLClient';
import { MyMemoryClient } from './MyMemoryClient';

const PROVIDER_KEY = 'translation_provider';
export type TranslationProvider = 'deepl' | 'mymemory';

export class TranslationRouter implements Translator {
  private readonly deeplClient = new DeepLClient();
  private readonly myMemoryClient = new MyMemoryClient();

  async translate(text: string, targetLang?: string): Promise<string> {
    const provider = await this.getProvider();
    const client = provider === 'deepl' ? this.deeplClient : this.myMemoryClient;
    return client.translate(text, targetLang);
  }

  async getProvider(): Promise<TranslationProvider> {
    const value = await SecureStore.getItemAsync(PROVIDER_KEY);
    return (value as TranslationProvider) ?? 'mymemory';
  }

  async setProvider(provider: TranslationProvider): Promise<void> {
    await SecureStore.setItemAsync(PROVIDER_KEY, provider);
  }

  async needsKey(): Promise<boolean> {
    const provider = await this.getProvider();
    if (provider === 'mymemory') return false;
    const key = await this.deeplClient.getApiKey();
    return !key;
  }
}
