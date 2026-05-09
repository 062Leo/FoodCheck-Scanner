import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCatalogStore } from '../../store/catalogStore';
import { ProductCard } from '../../components/ProductCard/ProductCard';
import type { ProductRecord } from '../../types/Product';
import type { ScanStatus } from '../../types/ScanResult';

type FilterStatus = 'All' | ScanStatus;

const FILTER_OPTIONS: FilterStatus[] = ['All', 'OK', 'Warning', 'Critical'];

export default function CatalogScreen() {
  const router = useRouter();
  const catalogStore = useCatalogStore();
  const [filter, setFilter] = useState<FilterStatus>('All');
  const [isLoading, setIsLoading] = useState(true);

  // Load all products on mount
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

  // Filter products client-side
  const filteredProducts = useCallback(() => {
    if (filter === 'All') {
      return catalogStore.products;
    }
    return catalogStore.products.filter((p) => p.rating === filter);
  }, [filter, catalogStore.products])();

  const handleSelectProduct = useCallback(
    (product: ProductRecord) => {
      // Navigate to ResultScreen with cached raw_json
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

  const handleDeleteProduct = useCallback(
    async (ean: string) => {
      try {
        await catalogStore.deleteProduct(ean);
      } catch (err) {
        console.error('Failed to delete product:', err);
      }
    },
    []
  );

  const handleToggleFavorite = useCallback(
    async (productId: number) => {
      try {
        await catalogStore.toggleFavorite(productId);
      } catch (err) {
        console.error('Failed to toggle favorite:', err);
      }
    },
    []
  );

  const isFavorite = useCallback(
    (productId: number | undefined) => {
      if (!productId) return false;
      return catalogStore.favorites.some((fav) => fav.id === productId);
    },
    []
  );

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
        <Text style={styles.title}>Mein Katalog</Text>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        {FILTER_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => setFilter(option)}
            style={[
              styles.filterChip,
              filter === option && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === option && styles.filterChipTextActive,
              ]}
            >
              {option === 'All' ? 'Alle' : option === 'Warning' ? 'Warnung' : option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {filter === 'All'
              ? 'Noch keine Produkte gescannt'
              : `Keine Produkte mit Status "${
                  filter === 'Warning' ? 'Warnung' : filter
                }"`}
          </Text>
        </View>
      )}

      {/* Product List */}
      {filteredProducts.length > 0 && (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.ean}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => handleSelectProduct(item)}
              onDelete={handleDeleteProduct}
              onToggleFavorite={handleToggleFavorite}
              isFavorite={isFavorite(item.id)}
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
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#404040',
  },
  filterChipActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#bbb',
  },
  filterChipTextActive: {
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
