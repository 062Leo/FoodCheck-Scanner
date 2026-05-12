jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Override USE_STAGING to false so tests don't depend on staging auth header
jest.mock('../config', () => ({
  ...jest.requireActual('../config'),
  USE_STAGING: false,
}));

import {
  OpenFoodFactsWriteClient,
  UploadError,
  ProductWritePayload,
} from '../OpenFoodFactsWriteClient';
import { ContributeFormData } from '../../../types/ContributeFormData';
import * as SecureStore from 'expo-secure-store';
import { APP_NAME, APP_VERSION } from '../config';

// Mock fetch
global.fetch = jest.fn();

describe('OpenFoodFactsWriteClient', () => {
  const client = new OpenFoodFactsWriteClient();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveCredentials', () => {
    it('should store username and password after verification', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        status: 200,
        text: async () => '',
      });

      await client.saveCredentials('testuser', 'testpass');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('off_username', 'testuser');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('off_password', 'testpass');
    });

    it('should reject with invalid credentials', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        status: 403,
        text: async () => 'Invalid user or password',
      });

      await expect(client.saveCredentials('baduser', 'badpass')).rejects.toThrow(
        'Invalid username or password'
      );
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });
  });

  describe('verifyCredentials', () => {
    it('should resolve for valid credentials', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        status: 200,
        text: async () => '',
      });

      await expect(client.verifyCredentials('testuser', 'testpass')).resolves.toBeUndefined();
    });

    it('should reject on HTTP 403', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        status: 403,
        text: async () => '',
      });

      await expect(client.verifyCredentials('baduser', 'badpass')).rejects.toThrow(
        'Invalid username or password'
      );
    });

    it('should reject when body contains auth error text', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        status: 200,
        text: async () => 'Invalid user or password',
      });

      await expect(client.verifyCredentials('baduser', 'badpass')).rejects.toThrow(
        'Invalid username or password'
      );
    });

    it('should post credentials to product_jqm2 endpoint', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        status: 200,
        text: async () => '',
      });

      await client.verifyCredentials('testuser', 'testpass');

      const url = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('/cgi/product_jqm2.pl');
      const body = (fetch as jest.Mock).mock.calls[0][1].body as FormData;
      expect(body.get('user_id')).toBe('testuser');
      expect(body.get('password')).toBe('testpass');
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

  describe('updateProduct', () => {
    const fullPayload: ProductWritePayload = {
      product_name: 'Test Product',
      brands: 'TestBrand',
      categories: 'TestCategory',
      quantity: '400g',
      serving_size: '15g',
      labels: 'en:organic',
      countries: 'en:germany',
      ingredients_text: 'Test ingredients',
      nutrition_data_per: '100g',
      nutriment_energy: '539',
      nutriment_energy_unit: 'kcal',
      nutriment_fat: '5',
      'nutriment_saturated-fat': '2',
      nutriment_carbohydrates: '10',
      nutriment_sugars: '5',
      nutriment_proteins: '6',
      nutriment_salt: '1',
      nutriment_sodium: '0.5',
      nutriment_sodium_unit: 'g',
      nutriment_fiber: '3',
      add_categories: 'Snacks',
      add_labels: 'en:fair-trade',
      add_brands: 'ExtraBrand',
    };

    it('should POST with all required auth fields', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');
      (fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '1' });

      await client.updateProduct('1234567890123', fullPayload);

      expect(fetch).toHaveBeenCalledTimes(1);
      const formDataArg = (fetch as jest.Mock).mock.calls[0][1].body as FormData;
      expect(formDataArg.get('code')).toBe('1234567890123');
      expect(formDataArg.get('user_id')).toBe('testuser');
      expect(formDataArg.get('password')).toBe('testpass');
      expect(formDataArg.get('app_name')).toBe(APP_NAME);
      expect(formDataArg.get('app_version')).toBe(APP_VERSION);
      expect(formDataArg.get('app_uuid')).toBeTruthy();
    });

    it('should POST with User-Agent header', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');
      (fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '1' });

      await client.updateProduct('123', fullPayload);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/cgi/product_jqm2.pl'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'User-Agent': 'TrueFoodScanner/1.0 (truefood-scanner@example.com)',
          }),
        })
      );
    });

    it('should send all payload fields in FormData', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');
      (fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '1' });

      await client.updateProduct('1234567890123', fullPayload);

      const formDataArg = (fetch as jest.Mock).mock.calls[0][1].body as FormData;
      expect(formDataArg.get('product_name')).toBe('Test Product');
      expect(formDataArg.get('brands')).toBe('TestBrand');
      expect(formDataArg.get('categories')).toBe('TestCategory');
      expect(formDataArg.get('quantity')).toBe('400g');
      expect(formDataArg.get('serving_size')).toBe('15g');
      expect(formDataArg.get('labels')).toBe('en:organic');
      expect(formDataArg.get('countries')).toBe('en:germany');
      expect(formDataArg.get('ingredients_text')).toBe('Test ingredients');
      expect(formDataArg.get('nutrition_data_per')).toBe('100g');
      expect(formDataArg.get('nutriment_energy')).toBe('539');
      expect(formDataArg.get('nutriment_energy_unit')).toBe('kcal');
      expect(formDataArg.get('nutriment_fat')).toBe('5');
      expect(formDataArg.get('nutriment_saturated-fat')).toBe('2');
      expect(formDataArg.get('nutriment_carbohydrates')).toBe('10');
      expect(formDataArg.get('nutriment_sugars')).toBe('5');
      expect(formDataArg.get('nutriment_proteins')).toBe('6');
      expect(formDataArg.get('nutriment_salt')).toBe('1');
      expect(formDataArg.get('nutriment_sodium')).toBe('0.5');
      expect(formDataArg.get('nutriment_sodium_unit')).toBe('g');
      expect(formDataArg.get('nutriment_fiber')).toBe('3');
      expect(formDataArg.get('add_categories')).toBe('Snacks');
      expect(formDataArg.get('add_labels')).toBe('en:fair-trade');
      expect(formDataArg.get('add_brands')).toBe('ExtraBrand');
    });

    it('should skip undefined, null, and empty string fields', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');
      (fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '1' });

      await client.updateProduct('123', {
        product_name: 'OnlyName',
        brands: '',
        categories: undefined,
      } as ProductWritePayload);

      const fd = (fetch as jest.Mock).mock.calls[0][1].body as FormData;
      expect(fd.get('product_name')).toBe('OnlyName');
      expect(fd.get('brands')).toBeNull();
      expect(fd.get('categories')).toBeNull();
      expect(fd.get('labels')).toBeNull();
    });

    it('should throw UploadError when no credentials', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(client.updateProduct('123', {})).rejects.toThrow(UploadError);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should throw UploadError on HTTP error', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');
      (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

      await expect(client.updateProduct('123', {})).rejects.toThrow(UploadError);
    });

    it('should throw UploadError when OFF returns non-success', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');
      (fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '0' });

      await expect(client.updateProduct('123', {})).rejects.toThrow(UploadError);
    });

    it('should throw UploadError when offline', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(client.updateProduct('123', {})).rejects.toThrow(UploadError);
    });
  });

  describe('submitNutritionData', () => {
    it('should call updateProduct with nutriment payload', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');
      (fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '1' });

      await client.submitNutritionData('1234567890123', {
        nutriment_energy: '2255',
        nutriment_energy_unit: 'kJ',
        nutriment_fat: '30.9',
        'nutriment_saturated-fat': '10.6',
        nutriment_carbohydrates: '57.5',
        nutriment_sugars: '56.3',
        nutriment_proteins: '6.3',
        nutriment_salt: '0.107',
      });

      const fd = (fetch as jest.Mock).mock.calls[0][1].body as FormData;
      expect(fd.get('nutriment_energy')).toBe('2255');
      expect(fd.get('nutriment_energy_unit')).toBe('kJ');
      expect(fd.get('nutriment_fat')).toBe('30.9');
      expect(fd.get('nutriment_proteins')).toBe('6.3');
      expect(fd.get('nutriment_salt')).toBe('0.107');
    });

    it('should throw UploadError on failure', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');
      (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 400 });

      await expect(client.submitNutritionData('123', { nutriment_fat: '1' })).rejects.toThrow(
        UploadError
      );
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

    it('should map ContributeFormData to OFF field names', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');
      (fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '1' });

      await client.uploadProduct(validData);

      const fd = (fetch as jest.Mock).mock.calls[0][1].body as FormData;
      expect(fd.get('code')).toBe('1234567890123');
      expect(fd.get('product_name')).toBe('Test Product');
      expect(fd.get('brands')).toBe('TestBrand');
      expect(fd.get('categories')).toBe('TestCategory');
      expect(fd.get('ingredients_text')).toBe('Test ingredients');
      expect(fd.get('nutriment_energy')).toBe('100');
      expect(fd.get('nutriment_energy_unit')).toBe('kcal');
      expect(fd.get('nutriment_fat')).toBe('5');
      expect(fd.get('nutriment_saturated-fat')).toBe('2');
      expect(fd.get('nutriment_carbohydrates')).toBe('10');
      expect(fd.get('nutriment_sugars')).toBe('5');
      expect(fd.get('nutriment_fiber')).toBe('3');
      expect(fd.get('nutriment_proteins')).toBe('6');
      expect(fd.get('nutriment_salt')).toBe('1');
    });

    it('should throw UploadError when no credentials', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(client.uploadProduct(validData)).rejects.toThrow(UploadError);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should throw UploadError when OFF returns non-success', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('testuser')
        .mockResolvedValueOnce('testpass');
      (fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '0' });

      await expect(client.uploadProduct(validData)).rejects.toThrow(UploadError);
    });
  });
});
