import { MyMemoryClient } from '../MyMemoryClient';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('MyMemoryClient', () => {
  let client: MyMemoryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new MyMemoryClient();
  });

  describe('getApiKey', () => {
    it('should return the stored key', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('mm-key-123');

      const result = await client.getApiKey();

      expect(result).toBe('mm-key-123');
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('mymemory_api_key');
    });

    it('should return null when no key is stored', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await client.getApiKey();

      expect(result).toBeNull();
    });
  });

  describe('saveApiKey', () => {
    it('should persist the key', async () => {
      await client.saveApiKey('my-mm-key');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('mymemory_api_key', 'my-mm-key');
    });
  });

  describe('deleteApiKey', () => {
    it('should remove the key', async () => {
      await client.deleteApiKey();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('mymemory_api_key');
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

    it('should call MyMemory API without key when none stored', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ responseData: { translatedText: 'Hello World' } }),
      });

      const result = await client.translate('Hallo Welt');

      expect(result).toBe('Hello World');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('autodetect|en'));
    });

    it('should call MyMemory API with key when stored', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('mm-key');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ responseData: { translatedText: 'Good day' } }),
      });

      const result = await client.translate('Guten Tag');

      expect(result).toBe('Good day');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('&key=mm-key'));
    });

    it('should use custom target language', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ responseData: { translatedText: 'Bonjour' } }),
      });

      const result = await client.translate('Hallo', 'fr');

      expect(result).toBe('Bonjour');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('autodetect|fr'));
    });

    it('should return original text when API response is not ok', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      mockFetch.mockResolvedValue({ ok: false });

      const result = await client.translate('Hallo');

      expect(result).toBe('Hallo');
    });

    it('should return original text on network error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await client.translate('Hallo');

      expect(result).toBe('Hallo');
    });

    it('should return original text on missing translation in response', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ responseData: {} }),
      });

      const result = await client.translate('Hallo');

      expect(result).toBe('Hallo');
    });
  });
});
