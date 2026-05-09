jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { OpenFoodFactsWriteClient, UploadError } from '../OpenFoodFactsWriteClient';
import { ContributeFormData } from '../../types/ContributeFormData';
import * as SecureStore from 'expo-secure-store';

// Mock fetch
global.fetch = jest.fn();

describe('OpenFoodFactsWriteClient', () => {
  const client = new OpenFoodFactsWriteClient();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveCredentials', () => {
    it('should store username and password', async () => {
      await client.saveCredentials('testuser', 'testpass');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('off_username', 'testuser');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('off_password', 'testpass');
    });
  });

  describe('loadCredentials', () => {
    it('should return credentials when both exist', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');

      const result = await client.loadCredentials();

      expect(result).toEqual({ username: 'testuser', password: 'testpass' });
    });

    it('should return null when username missing', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('testpass');

      const result = await client.loadCredentials();

      expect(result).toBeNull();
    });

    it('should return null when password missing', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce(null);

      const result = await client.loadCredentials();

      expect(result).toBeNull();
    });
  });

  describe('uploadProduct', () => {
    const validData: ContributeFormData = {
      ean: '1234567890123',
      productName: 'Test Product',
      brands: 'TestBrand',
      categories: 'TestCategory',
      ingredientsText: 'Test ingredients',
      nutriments: {
        energyKcal100g: 100,
        fat100g: 5,
        saturatedFat100g: 2,
        carbohydrates100g: 10,
        sugars100g: 5,
        fiber100g: 3,
        proteins100g: 6,
        salt100g: 1,
      },
    };

    it('should call fetch with correct URL and body when valid data', async () => {
      // Mock credentials
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');

      // Mock fetch success
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => '1',
      });

      await client.uploadProduct(validData);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        'https://world.openfoodfacts.org/cgi/product_jqm2.pl',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'User-Agent': 'FoodScanner/1.0 (private)',
          }),
          body: expect.any(FormData),
        })
      );

      // Check FormData contents
      const formDataArg = (fetch as jest.Mock).mock.calls[0][1].body as FormData;
      expect(formDataArg.get('code')).toBe('1234567890123');
      expect(formDataArg.get('user_id')).toBe('testuser');
      expect(formDataArg.get('password')).toBe('testpass');
      expect(formDataArg.get('product_name')).toBe('Test Product');
      expect(formDataArg.get('brands')).toBe('TestBrand');
      expect(formDataArg.get('categories')).toBe('TestCategory');
      expect(formDataArg.get('ingredients_text')).toBe('Test ingredients');
      expect(formDataArg.get('nutriments_energy-kcal_100g')).toBe('100');
      expect(formDataArg.get('nutriments_fat_100g')).toBe('5');
    });

    it('should throw UploadError when offline/network error', async () => {
      // Mock credentials
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');

      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(client.uploadProduct(validData)).rejects.toThrow(UploadError);
    });

    it('should throw UploadError when HTTP error', async () => {
      // Mock credentials
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');

      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(client.uploadProduct(validData)).rejects.toThrow(UploadError);
    });

    it('should throw UploadError when no credentials', async () => {
      // Mock credentials
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(client.uploadProduct(validData)).rejects.toThrow(UploadError);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should throw UploadError when OFF returns non-success', async () => {
      // Mock credentials
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => '0',
      });

      await expect(client.uploadProduct(validData)).rejects.toThrow(UploadError);
    });
  });
});