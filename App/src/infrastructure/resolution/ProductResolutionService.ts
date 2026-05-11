import NetInfo from '@react-native-community/netinfo';
import type { Product, ProductRecord } from '../../types/Product';
import { ProductRepository } from '../db/ProductRepository';
import { OpenFoodFactsClient } from '../api/OpenFoodFactsClient';

export const STALE_THRESHOLD_DAYS = 7;

export interface ScanLookupResult {
  product: Product;
  record: ProductRecord | null;
  fromCache: boolean;
  isStale: boolean;
}

export class ProductResolutionService {
  private repository: ProductRepository;
  private apiClient: OpenFoodFactsClient;

  constructor(repository?: ProductRepository, apiClient?: OpenFoodFactsClient) {
    this.repository = repository || new ProductRepository();
    this.apiClient = apiClient || new OpenFoodFactsClient();
  }

  async checkCache(ean: string): Promise<ProductRecord | null> {
    try {
      return await this.repository.findByEan(ean);
    } catch {
      return null;
    }
  }

  async isOnline(): Promise<boolean> {
    const netState = await NetInfo.fetch();
    return netState.isConnected ?? false;
  }

  isStale(record: ProductRecord): boolean {
    if (!record.last_api_fetch) return false;
    const lastFetch = new Date(record.last_api_fetch).getTime();
    const now = Date.now();
    const daysSinceFetch = (now - lastFetch) / (1000 * 60 * 60 * 24);
    return daysSinceFetch > STALE_THRESHOLD_DAYS;
  }

  async fetchFresh(ean: string): Promise<Product | null> {
    try {
      return await this.apiClient.getProductByEan(ean);
    } catch {
      return null;
    }
  }
}
