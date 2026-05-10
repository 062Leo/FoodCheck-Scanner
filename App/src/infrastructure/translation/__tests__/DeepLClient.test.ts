import { DeepLClient } from '../DeepLClient';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('DeepLClient', () => {
  let client: DeepLClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new DeepLClient();
  });

  describe('getApiKey', () => {
    it('should return the stored key', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-key-123');

      const result = await client.getApiKey();

      expect(result).toBe('test-key-123');
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('deepl_api_key');
    });

    it('should return null when no key is stored', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await client.getApiKey();

      expect(result).toBeNull();
    });
  });

  describe('saveApiKey', () => {
    it('should persist the key to secure store', async () => {
      await client.saveApiKey('my-deepl-key');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('deepl_api_key', 'my-deepl-key');
    });
  });

  describe('deleteApiKey', () => {
    it('should remove the key from secure store', async () => {
      await client.deleteApiKey();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('deepl_api_key');
    });
  });

  describe('translate', () => {
    it('should return original text when input is empty', async () => {
      const result = await client.translate('');

      expect(result).toBe('');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return original text when input is only whitespace', async () => {
      const result = await client.translate('   ');

      expect(result).toBe('   ');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return original text when no API key is configured', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await client.translate('Hallo Welt');

      expect(result).toBe('Hallo Welt');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should call DeepL API and return translated text', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-key');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          translations: [{ detected_source_language: 'DE', text: 'Hello World' }],
        }),
      });

      const result = await client.translate('Hallo Welt');

      expect(result).toBe('Hello World');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api-free.deepl.com/v2/translate',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'DeepL-Auth-Key valid-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: ['Hallo Welt'],
            target_lang: 'EN',
          }),
        })
      );
    });

    it('should return original text when API response is not ok', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-key');
      mockFetch.mockResolvedValue({ ok: false, status: 403 });

      const result = await client.translate('Hallo Welt');

      expect(result).toBe('Hallo Welt');
    });

    it('should return original text when translations array is empty', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-key');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ translations: [] }),
      });

      const result = await client.translate('Hallo Welt');

      expect(result).toBe('Hallo Welt');
    });

    it('should return original text when translations field is missing', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-key');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await client.translate('Hallo Welt');

      expect(result).toBe('Hallo Welt');
    });

    it('should return original text on network error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-key');
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const result = await client.translate('Hallo Welt');

      expect(result).toBe('Hallo Welt');
    });

    it('should return original text on invalid JSON response', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-key');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const result = await client.translate('Hallo Welt');

      expect(result).toBe('Hallo Welt');
    });
  });
});
