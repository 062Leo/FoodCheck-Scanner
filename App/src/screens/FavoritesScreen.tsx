import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useCatalogStore } from '../store/catalogStore';
import { ProductCard } from '../components/ProductCard/ProductCard';
import type { ProductRecord } from '../types/Product';

export default function FavoritesScreen() {
  const router = useRouter();
  const catalogStore = useCatalogStore();
  const [isLoading, setIsLoading] = useState(true);

  // Load all products on mount to populate favorites
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        await catalogStore.loadAll();
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSelectProduct = useCallback(
    (product: ProductRecord) => {
      // Navigate to ProductScreen with cached raw_json
      if (product.raw_json) {
        try {
          const parsedJson = JSON.parse(product.raw_json);
          // Pass the product data and indicate it's from cache
          router.push({
            pathname: '/result',
            params: {
              ean: product.ean,
              fromCache: 'true',
              cachedData: JSON.stringify(parsedJson),
            },
          });
        } catch (err) {
          console.error('Failed to parse cached data:', err);
          // Fallback to normal scan
          router.push({
            pathname: '/result',
            params: { ean: product.ean },
          });
        }
      } else {
        // Fallback if no cache
        router.push({
          pathname: '/result',
          params: { ean: product.ean },
        });
      }
    },
    [router]
  );

  const handleDeleteProduct = useCallback(async (ean: string) => {
    try {
      await catalogStore.deleteProduct(ean);
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  }, []);

  const handleToggleFavorite = useCallback(async (productId: number) => {
    try {
      await catalogStore.toggleFavorite(productId);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Meine Favoriten</Text>
      </View>

      {/* Empty State */}
      {catalogStore.favorites.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Noch keine Favoriten – tippe im Scan-Ergebnis auf ★</Text>
        </View>
      )}

      {/* Favorites List */}
      {catalogStore.favorites.length > 0 && (
        <FlatList
          data={catalogStore.favorites}
          extraData={catalogStore.favorites.length}
          keyExtractor={(item) => item.ean}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => handleSelectProduct(item)}
              onDelete={handleDeleteProduct}
              onToggleFavorite={handleToggleFavorite}
              isFavorite={true}
            />
          )}
          scrollEnabled
          nestedScrollEnabled
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  header: {
    paddingTop: 32,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: 8,
  },
});
