import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import type { ProductSummary } from '../../types/Product';
import type { TranslateFn } from '../../i18n/useTranslation';
import { displayProductName } from '../../domain/product/productName';
import { ProductRepository } from '../../infrastructure/db/ProductRepository';
import { FavoritesRepository } from '../../infrastructure/db/FavoritesRepository';
import { useCatalogStore } from '../../store/catalogStore';

const products = new ProductRepository();
const favorites = new FavoritesRepository();

export interface ListToast {
  /** New for every toast, so a repeated message restarts its timer. */
  id: number;
  message: string;
  type: 'info' | 'error';
  undo?: () => Promise<void>;
}

let nextToastId = 1;

/** Open, favorite, edit and delete actions shared by the catalog and favorites lists. */
export function useProductListActions(t: TranslateFn) {
  const router = useRouter();
  const favoriteList = useCatalogStore((s) => s.favorites);
  const toggleFavorite = useCatalogStore((s) => s.toggleFavorite);
  const [toast, setToast] = useState<ListToast | null>(null);

  const favoriteIds = useMemo(() => new Set(favoriteList.map((f) => f.id)), [favoriteList]);

  const showToast = useCallback((next: Omit<ListToast, 'id'>) => {
    setToast({ ...next, id: nextToastId++ });
  }, []);

  /** Runs an undo and reports when it could not be applied. */
  const undoable = useCallback(
    (message: string, undo: () => Promise<void>) => {
      showToast({
        message,
        type: 'info',
        undo: async () => {
          try {
            await undo();
          } catch (error) {
            console.error('Undo failed:', error);
            showToast({ message: t('catalog.undoFailed'), type: 'error' });
          } finally {
            await useCatalogStore.getState().loadAll();
          }
        },
      });
    },
    [showToast, t]
  );

  const open = useCallback(
    (product: ProductSummary) => {
      router.push({ pathname: '/result', params: { ean: product.ean } });
    },
    [router]
  );

  const onToggleFavorite = useCallback(
    async (product: ProductSummary) => {
      const productId = product.id;
      if (productId === undefined) return;
      const addedAt = favoriteIds.has(productId) ? await favorites.findAddedAt(productId) : null;
      await toggleFavorite(productId);
      if (addedAt) {
        undoable(t('favorites.removed'), () => favorites.add(productId, addedAt));
      }
    },
    [favoriteIds, t, toggleFavorite, undoable]
  );

  const remove = useCallback(
    async (product: ProductSummary) => {
      try {
        const record = await products.findByEan(product.ean);
        if (!record) return;
        const addedAt = record.id !== undefined ? await favorites.findAddedAt(record.id) : null;
        await products.deleteByEan(product.ean);
        await useCatalogStore.getState().loadAll();
        undoable(t('catalog.deleted'), async () => {
          await products.restore(record);
          if (addedAt && record.id !== undefined) await favorites.add(record.id, addedAt);
        });
      } catch (error) {
        console.error(`Failed to delete product ${product.ean}:`, error);
        showToast({ message: t('catalog.deleteFailed'), type: 'error' });
      }
    },
    [showToast, t, undoable]
  );

  const more = useCallback(
    (product: ProductSummary) => {
      Alert.alert(displayProductName(product.name, t('product.unknown')), undefined, [
        {
          text: t('a11y.editProduct'),
          onPress: () => router.push({ pathname: '/edit/[ean]', params: { ean: product.ean } }),
        },
        { text: t('catalog.delete'), style: 'destructive', onPress: () => void remove(product) },
        { text: t('edit.cancel'), style: 'cancel' },
      ]);
    },
    [remove, router, t]
  );

  return { favoriteIds, open, onToggleFavorite, more, toast, clearToast: () => setToast(null) };
}
