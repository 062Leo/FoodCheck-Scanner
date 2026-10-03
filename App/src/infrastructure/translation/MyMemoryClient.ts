import * as SecureStore from 'expo-secure-store';
import type { Translator } from '../../domain/translation/Translator';
import { fetchWithTimeout } from '../api/fetchWithTimeout';

const SECURE_KEY = 'mymemory_api_key';
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

export class MyMemoryClient implements Translator {
  async translate(text: string, targetLang: string = 'EN'): Promise<string> {
    if (!text.trim()) return text;

    const apiKey = await this.getApiKey();
    try {
      const url =
        `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=autodetect|${targetLang.toLowerCase()}` +
        (apiKey ? `&key=${apiKey}` : '');
      const response = await fetchWithTimeout(url, {}, 10000);
      if (!response.ok) return text;
      const data = await response.json();
      // Quota and input errors arrive with HTTP 200 and the error message as
      // "translation"; only a responseStatus of 200 is a real result.
      if (Number(data.responseStatus) !== 200) return text;
      return data.responseData?.translatedText ?? text;
    } catch {
      return text;
    }
  }

  async getApiKey(): Promise<string | null> {
    return SecureStore.getItemAsync(SECURE_KEY);
  }

  async saveApiKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(SECURE_KEY, key);
  }

  async deleteApiKey(): Promise<void> {
    await SecureStore.deleteItemAsync(SECURE_KEY);
  }
}
