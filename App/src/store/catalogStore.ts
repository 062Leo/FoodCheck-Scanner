import { create } from 'zustand';

import { FavoritesRepository } from '../infrastructure/db/FavoritesRepository';
import { ProductRepository } from '../infrastructure/db/ProductRepository';
import type { ProductRecord } from '../types/Product';

interface CatalogStoreState {
  products: ProductRecord[];
  favorites: ProductRecord[];
  isLoading: boolean;
  loadAll: () => Promise<void>;
  addProduct: (product: ProductRecord) => Promise<void>;
  deleteProduct: (ean: string) => Promise<void>;
  toggleFavorite: (productId: number) => Promise<void>;
}

const productRepository = new ProductRepository();
const favoritesRepository = new FavoritesRepository();

export const useCatalogStore = create<CatalogStoreState>((set, get) => ({
  products: [],
  favorites: [],
  isLoading: false,

  loadAll: async () => {
    set({ isLoading: true });

    try {
      const [products, favorites] = await Promise.all([
        productRepository.findAll(),
        favoritesRepository.findAll(),
      ]);

      set({ products, favorites });
    } catch (error) {
      console.error('Failed to load catalog state:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addProduct: async (product: ProductRecord) => {
    set({ isLoading: true });

    try {
      await productRepository.insert(product);
      await get().loadAll();
    } catch (error) {
      console.error(`Failed to add product ${product.ean}:`, error);
    } finally {
      set({ isLoading: false });
    }
  },

  deleteProduct: async (ean: string) => {
    set({ isLoading: true });

    try {
      await productRepository.deleteByEan(ean);
      await get().loadAll();
    } catch (error) {
      console.error(`Failed to delete product ${ean}:`, error);
    } finally {
      set({ isLoading: false });
    }
  },

  toggleFavorite: async (productId: number) => {
    set({ isLoading: true });

    try {
      const isFavorite = await favoritesRepository.isFavorite(productId);

      if (isFavorite) {
        await favoritesRepository.remove(productId);
      } else {
        await favoritesRepository.add(productId);
      }

      const favorites = await favoritesRepository.findAll();
      set({ favorites });
    } catch (error) {
      console.error(`Failed to toggle favorite for product ${productId}:`, error);
    } finally {
      set({ isLoading: false });
    }
  },
}));