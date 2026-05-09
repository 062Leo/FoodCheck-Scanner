import * as SecureStore from 'expo-secure-store';
import { ContributeFormData } from '../../types/ContributeFormData';
import { NutrimentData } from '../../types/ContributeFormData';

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export class OpenFoodFactsWriteClient {
  private readonly uploadUrl = 'https://world.openfoodfacts.org/cgi/product_jqm2.pl';
  private readonly userAgent = 'FoodScanner/1.0 (private)';

  async saveCredentials(username: string, password: string): Promise<void> {
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

  async uploadProduct(data: ContributeFormData): Promise<void> {
    try {
      const credentials = await this.loadCredentials();
      if (!credentials) {
        throw new UploadError('No credentials stored. Please save credentials first.');
      }

      const formData = new FormData();
      formData.append('code', data.ean);
      formData.append('user_id', credentials.username);
      formData.append('password', credentials.password);
      formData.append('product_name', data.productName);
      if (data.brands) formData.append('brands', data.brands);
      if (data.categories) formData.append('categories', data.categories);
      if (data.ingredientsText) formData.append('ingredients_text', data.ingredientsText);

      if (data.nutriments) {
        this.appendNutriment(formData, data.nutriments);
      }

      const response = await fetch(this.uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        throw new UploadError(`Upload failed with status ${response.status}`);
      }

      // OFF returns 1 in the body for success
      const text = await response.text();
      if (!text.includes('1')) {
        throw new UploadError('Upload failed: OFF did not return success');
      }
    } catch (error) {
      if (error instanceof UploadError) {
        throw error;
      }
      throw new UploadError(
        `Failed to upload product: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  private appendNutriment(formData: FormData, nutriments: NutrimentData): void {
    if (nutriments.energyKcal100g !== undefined)
      formData.append('nutriments_energy-kcal_100g', String(nutriments.energyKcal100g));
    if (nutriments.fat100g !== undefined)
      formData.append('nutriments_fat_100g', String(nutriments.fat100g));
    if (nutriments.saturatedFat100g !== undefined)
      formData.append('nutriments_saturated-fat_100g', String(nutriments.saturatedFat100g));
    if (nutriments.carbohydrates100g !== undefined)
      formData.append('nutriments_carbohydrates_100g', String(nutriments.carbohydrates100g));
    if (nutriments.sugars100g !== undefined)
      formData.append('nutriments_sugars_100g', String(nutriments.sugars100g));
    if (nutriments.fiber100g !== undefined)
      formData.append('nutriments_fiber_100g', String(nutriments.fiber100g));
    if (nutriments.proteins100g !== undefined)
      formData.append('nutriments_proteins_100g', String(nutriments.proteins100g));
    if (nutriments.salt100g !== undefined)
      formData.append('nutriments_salt_100g', String(nutriments.salt100g));
  }
}
