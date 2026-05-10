import * as SecureStore from 'expo-secure-store';
import type { Translator } from '../../domain/translation/Translator';

const SECURE_KEY = 'deepl_api_key';
const DEEPL_URL = 'https://api-free.deepl.com/v2/translate';

export class DeepLClient implements Translator {
  async translate(text: string, targetLang: string = 'EN'): Promise<string> {
    if (!text.trim()) return text;

    const apiKey = await this.getApiKey();
    if (!apiKey) return text;

    try {
      const response = await fetch(DEEPL_URL, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: [text],
          target_lang: targetLang.toUpperCase(),
        }),
      });

      if (!response.ok) return text;

      const data = await response.json();
      return data.translations?.[0]?.text ?? text;
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
