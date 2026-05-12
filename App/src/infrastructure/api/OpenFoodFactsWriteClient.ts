import * as SecureStore from 'expo-secure-store';
import { ContributeFormData } from '../../types/ContributeFormData';
import {
  BASE_URL,
  USER_AGENT,
  STAGING_AUTH,
  USE_STAGING,
  APP_NAME,
  APP_VERSION,
  generateAppUUID,
} from './config';
import { ApiError } from './ApiError';
import { retryWithBackoff } from './retry';

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export interface ProductWritePayload {
  product_name?: string;
  brands?: string;
  categories?: string;
  quantity?: string;
  serving_size?: string;
  labels?: string;
  countries?: string;
  ingredients_text?: string;
  nutrition_data_per?: '100g' | 'serving';
  nutriment_energy?: string;
  nutriment_energy_unit?: string;
  nutriment_fat?: string;
  'nutriment_saturated-fat'?: string;
  nutriment_carbohydrates?: string;
  nutriment_sugars?: string;
  nutriment_proteins?: string;
  nutriment_salt?: string;
  nutriment_sodium?: string;
  nutriment_sodium_unit?: string;
  nutriment_fiber?: string;
  no_nutrition_data?: 'on';
  add_categories?: string;
  add_labels?: string;
  add_brands?: string;
}

export type NutrimentPayload = Pick<
  ProductWritePayload,
  | 'nutriment_energy'
  | 'nutriment_energy_unit'
  | 'nutriment_fat'
  | 'nutriment_saturated-fat'
  | 'nutriment_carbohydrates'
  | 'nutriment_sugars'
  | 'nutriment_proteins'
  | 'nutriment_salt'
  | 'nutriment_sodium'
  | 'nutriment_sodium_unit'
  | 'nutriment_fiber'
  | 'no_nutrition_data'
>;

export class OpenFoodFactsWriteClient {
  private readonly uploadUrl = `${BASE_URL}/cgi/product_jqm2.pl`;

  async verifyCredentials(username: string, password: string): Promise<void> {
    const formData = new FormData();
    formData.append('user_id', username);
    formData.append('password', password);

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
    };
    if (USE_STAGING) {
      headers['Authorization'] = STAGING_AUTH;
    }

    const response = await fetch(this.uploadUrl, {
      method: 'POST',
      body: formData,
      headers,
    });

    // OFF returns HTTP 403 for invalid credentials (before checking product fields)
    if (response.status === 403) {
      throw new Error('Invalid username or password');
    }

    const text = await response.text();
    if (text.includes('Invalid user') || text.includes('Invalid password')) {
      throw new Error('Invalid username or password');
    }
  }

  async saveCredentials(username: string, password: string): Promise<void> {
    await this.verifyCredentials(username, password);
    await SecureStore.setItemAsync('off_username', username);
    await SecureStore.setItemAsync('off_password', password);
  }

  async loadCredentials(): Promise<{ username: string; password: string } | null> {
    const [username, password] = await Promise.all([
      SecureStore.getItemAsync('off_username'),
      SecureStore.getItemAsync('off_password'),
    ]);

    if (username && password) {
      return { username, password };
    }
    return null;
  }

  async deleteCredentials(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync('off_username'),
      SecureStore.deleteItemAsync('off_password'),
    ]);
  }

  async updateProduct(barcode: string, payload: ProductWritePayload): Promise<void> {
    return retryWithBackoff(async () => {
      try {
        const credentials = await this.loadCredentials();
        if (!credentials) {
          throw new UploadError('No credentials stored. Please save credentials first.');
        }

        const formData = new FormData();
        formData.append('code', barcode);
        formData.append('user_id', credentials.username);
        formData.append('password', credentials.password);
        formData.append('app_name', APP_NAME);
        formData.append('app_version', APP_VERSION);
        formData.append('app_uuid', generateAppUUID(credentials.username));

        for (const [key, value] of Object.entries(payload)) {
          if (value !== undefined && value !== null && value !== '') {
            formData.append(key, value);
          }
        }

        const headers: Record<string, string> = {
          'User-Agent': USER_AGENT,
        };
        if (USE_STAGING) {
          headers['Authorization'] = STAGING_AUTH;
        }

        const response = await fetch(this.uploadUrl, {
          method: 'POST',
          body: formData,
          headers,
        });

        if (!response.ok) {
          throw ApiError.fromHttpStatus(response.status);
        }

        const text = await response.text();
        if (!text.includes('1')) {
          const snippet = text.replace(/\s+/g, ' ').trim().substring(0, 200);
          throw new UploadError(`Upload failed: ${snippet || 'empty response'}`);
        }
      } catch (error) {
        if (error instanceof ApiError && error.retryable) throw error;
        if (error instanceof UploadError) throw error;
        throw new UploadError(
          `Failed to upload product: ${error instanceof Error ? error.message : String(error)}`,
          error
        );
      }
    });
  }

  async submitNutritionData(barcode: string, nutriments: NutrimentPayload): Promise<void> {
    return this.updateProduct(barcode, nutriments);
  }

  async uploadProduct(data: ContributeFormData): Promise<void> {
    const payload: ProductWritePayload = {
      product_name: data.productName,
      brands: data.brands,
      categories: data.categories,
      ingredients_text: data.ingredientsText,
    };

    if (data.ingredientsByLang) {
      Object.entries(data.ingredientsByLang).forEach(([lang, text]) => {
        if (text) {
          (payload as Record<string, string>)[`ingredients_text_${lang}`] = text;
        }
      });
    }

    if (data.nutriments) {
      payload.nutriment_energy = data.nutriments.energyKcal100g?.toString();
      payload.nutriment_energy_unit = 'kcal';
      if (data.nutriments.fat100g !== undefined)
        payload.nutriment_fat = data.nutriments.fat100g.toString();
      if (data.nutriments.saturatedFat100g !== undefined)
        payload['nutriment_saturated-fat'] = data.nutriments.saturatedFat100g.toString();
      if (data.nutriments.carbohydrates100g !== undefined)
        payload.nutriment_carbohydrates = data.nutriments.carbohydrates100g.toString();
      if (data.nutriments.sugars100g !== undefined)
        payload.nutriment_sugars = data.nutriments.sugars100g.toString();
      if (data.nutriments.fiber100g !== undefined)
        payload.nutriment_fiber = data.nutriments.fiber100g.toString();
      if (data.nutriments.proteins100g !== undefined)
        payload.nutriment_proteins = data.nutriments.proteins100g.toString();
      if (data.nutriments.salt100g !== undefined)
        payload.nutriment_salt = data.nutriments.salt100g.toString();
    }

    return this.updateProduct(data.ean, payload);
  }
}
