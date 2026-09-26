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

export interface UndoToast {
  message: string;
  undo: () => void;
}

/** Open, favorite, edit and delete actions shared by the catalog and favorites lists. */
export function useProductListActions(t: TranslateFn) {
  const router = useRouter();
  const favoriteList = useCatalogStore((s) => s.favorites);
  const toggleFavorite = useCatalogStore((s) => s.toggleFavorite);
  const [toast, setToast] = useState<UndoToast | null>(null);

  const favoriteIds = useMemo(() => new Set(favoriteList.map((f) => f.id)), [favoriteList]);

  const open = useCallback(
    (product: ProductSummary) => {
      router.push({ pathname: '/result', params: { ean: product.ean } });
    },
    [router]
  );

  const onToggleFavorite = useCallback(
    async (product: ProductSummary) => {
      if (product.id === undefined) return;
      const wasFavorite = favoriteIds.has(product.id);
      await toggleFavorite(product.id);
      if (wasFavorite) {
        setToast({
          message: t('favorites.removed'),
          undo: () => void toggleFavorite(product.id!),
        });
      }
    },
    [favoriteIds, t, toggleFavorite]
  );

  const remove = useCallback(
    async (product: ProductSummary) => {
      const record = await products.findByEan(product.ean);
      if (!record) return;
      const wasFavorite = record.id !== undefined && (await favorites.isFavorite(record.id));
      await products.deleteByEan(product.ean);
      await useCatalogStore.getState().loadAll();
      setToast({
        message: t('catalog.deleted'),
        undo: async () => {
          await products.restore(record);
          if (wasFavorite && record.id !== undefined) await favorites.add(record.id);
          await useCatalogStore.getState().loadAll();
        },
      });
    },
    [t]
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
