import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  SectionList,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCatalogStore } from '../store/catalogStore';
import { ProductCard } from '../components/ProductCard';
import { ProductRepository } from '../infrastructure/db/ProductRepository';
import { ProductStatistics } from '../domain/analysis/ProductStatistics';
import { useTranslation } from '../i18n/useTranslation';
import type { ProductRecord } from '../types/Product';
import type { ScanStatus } from '../types/ScanResult';
import type { ProductStats } from '../domain/analysis/ProductStatistics';

type FilterStatus = 'All' | ScanStatus;
type SortField = 'scanned_at' | 'name' | 'rating' | 'nova_score' | 'visit_count';
type SortOrder = 'asc' | 'desc';

const FILTER_OPTIONS: FilterStatus[] = ['All', 'OK', 'Warning', 'Critical'];
const SORT_OPTIONS: { field: SortField; key: string }[] = [
  { field: 'scanned_at', key: 'catalog.sort.date' },
  { field: 'name', key: 'catalog.sort.name' },
  { field: 'rating', key: 'catalog.sort.rating' },
  { field: 'nova_score', key: 'catalog.sort.nova' },
  { field: 'visit_count', key: 'catalog.sort.frequency' },
];

interface CollectionSection {
  title: string;
  data: ProductRecord[];
}

const repository = new ProductRepository();

export default function CatalogScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const catalogStore = useCatalogStore();

  const [filter, setFilter] = useState<FilterStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('scanned_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductRecord[]>([]);

  const [showCollections, setShowCollections] = useState(false);
  const [missingIngredientsOnly, setMissingIngredientsOnly] = useState(false);

  const stats = useMemo<ProductStats | null>(() => {
    const products = catalogStore.products;
    if (products.length === 0) return null;

    const totalScans = products.reduce((sum, p) => sum + (p.visit_count ?? 1), 0);

    const ratingDistribution: Record<string, number> = {};
    const novaDistribution: Record<string, number> = {};
    for (const p of products) {
      const r = p.rating || 'Unknown';
      ratingDistribution[r] = (ratingDistribution[r] || 0) + 1;
      if (p.nova_score != null) {
        novaDistribution[String(p.nova_score)] = (novaDistribution[String(p.nova_score)] || 0) + 1;
      }
    }

    return ProductStatistics.computeStats(products, {
      totalScans,
      ratingDistribution,
      novaDistribution,
    });
  }, [catalogStore.products]);

  const mostScanned = useMemo(
    () =>
      [...catalogStore.products]
        .sort((a, b) => (b.visit_count ?? 1) - (a.visit_count ?? 1))
        .slice(0, 5),
    [catalogStore.products]
  );

  const highestRisk = useMemo(
    () => catalogStore.products.filter((p) => p.rating === 'Critical').slice(0, 5),
    [catalogStore.products]
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          setIsLoading(true);
          await useCatalogStore.getState().loadAll();
          if (cancelled) return;
        } catch (err) {
          if (!cancelled) console.error('Failed to load products:', err);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const results = await repository.searchByName(query.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const sortProducts = useCallback(
    (products: ProductRecord[]): ProductRecord[] => {
      return [...products].sort((a, b) => {
        const comparison = ((): number => {
          switch (sortField) {
            case 'name':
              return (a.name || '').localeCompare(b.name || '');
            case 'rating':
              return (a.rating || '').localeCompare(b.rating || '');
            case 'nova_score':
              return (a.nova_score || 0) - (b.nova_score || 0);
            case 'visit_count':
              return (a.visit_count || 0) - (b.visit_count || 0);
            case 'scanned_at':
            default:
              return (a.scanned_at || '').localeCompare(b.scanned_at || '');
          }
        })();
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    },
    [sortField, sortOrder]
  );

  const missingIngredientsCount = useMemo(
    () => catalogStore.products.filter((p) => !p.ingredients).length,
    [catalogStore.products]
  );

  const filteredProducts = useMemo(() => {
    let products = catalogStore.products;
    if (filter !== 'All') {
      products = products.filter((p) => p.rating === filter);
    }
    if (missingIngredientsOnly) {
      products = products.filter((p) => !p.ingredients);
    }
    return sortProducts(products);
  }, [filter, missingIngredientsOnly, catalogStore.products, sortProducts]);

  const isFavorite = useCallback(
    (productId: number | undefined) => {
      if (!productId) return false;
      return catalogStore.favorites.some((fav) => fav.id === productId);
    },
    [catalogStore.favorites]
  );

  const handleSelectProduct = useCallback(
    (product: ProductRecord) => {
      if (product.raw_json) {
        try {
          const parsedJson = JSON.parse(product.raw_json);
          router.push({
            pathname: '/result',
            params: {
              ean: product.ean,
              fromCache: 'true',
              cachedData: JSON.stringify(parsedJson),
            },
          });
          return;
        } catch {
          // Fallback
        }
      }
      router.push({ pathname: '/result', params: { ean: product.ean } });
    },
    [router]
  );

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  const collections: CollectionSection[] = [];
  if (
    showCollections &&
    mostScanned.length > 0 &&
    filter === 'All' &&
    !searchQuery &&
    !missingIngredientsOnly
  ) {
    collections.push({ title: t('catalog.collection.mostScanned'), data: mostScanned });
  }
  if (
    showCollections &&
    highestRisk.length > 0 &&
    filter === 'All' &&
    !searchQuery &&
    !missingIngredientsOnly
  ) {
    collections.push({ title: t('catalog.collection.highestRisk'), data: highestRisk });
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C4DFF" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('catalog.title')}</Text>
        <TouchableOpacity onPress={() => setShowSearch(!showSearch)}>
          <Text style={styles.searchToggle}>{showSearch ? '✕' : '🔍'}</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('catalog.searchPlaceholder')}
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
            returnKeyType="search"
          />
          {isSearching && (
            <ActivityIndicator size="small" color="#7C4DFF" style={styles.searchSpinner} />
          )}
        </View>
      )}

      {/* Stats Summary */}
      {stats && !searchQuery && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalProducts}</Text>
            <Text style={styles.statLabel}>{t('catalog.products')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalScans}</Text>
            <Text style={styles.statLabel}>{t('catalog.scans')}</Text>
          </View>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => setShowCollections(!showCollections)}
          >
            <Text style={styles.statNumber}>
              {stats.ultraProcessedRatio > 0
                ? `${Math.round(stats.ultraProcessedRatio * 100)}%`
                : '–'}
            </Text>
            <Text style={styles.statLabel}>{t('catalog.nova4')}</Text>
          </TouchableOpacity>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.ratingDistribution['Critical'] || 0}</Text>
            <Text style={styles.statLabel}>{t('catalog.critical')}</Text>
          </View>
        </View>
      )}

      {/* Sort Row */}
      {!searchQuery && (
        <View style={styles.sortContainer}>
          <View style={styles.sortOptions}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.field}
                onPress={() => {
                  if (sortField === opt.field) {
                    toggleSortOrder();
                  } else {
                    setSortField(opt.field);
                    setSortOrder('desc');
                  }
                }}
                style={[styles.sortChip, sortField === opt.field && styles.sortChipActive]}
              >
                <Text
                  style={[
                    styles.sortChipText,
                    sortField === opt.field && styles.sortChipTextActive,
                  ]}
                >
                  {t(opt.key)}
                  {sortField === opt.field ? (sortOrder === 'desc' ? ' ↓' : ' ↑') : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        {FILTER_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => setFilter(option)}
            style={[styles.filterChip, filter === option && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filter === option && styles.filterChipTextActive]}>
              {option === 'All'
                ? t('catalog.filter.all')
                : option === 'Warning'
                  ? t('catalog.filter.warning')
                  : option}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={() => {
            setMissingIngredientsOnly(!missingIngredientsOnly);
            if (!missingIngredientsOnly) setFilter('All');
          }}
          style={[
            styles.filterChip,
            styles.needsIngredientsChip,
            missingIngredientsOnly && styles.needsIngredientsChipActive,
          ]}
        >
          <Text
            style={[styles.filterChipText, missingIngredientsOnly && styles.filterChipTextActive]}
          >
            {t('catalog.filter.missingIngredients')} ({missingIngredientsCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {searchQuery ? (
        // Search results
        searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.ean}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                onPress={() => handleSelectProduct(item)}
                onDelete={async (ean) => {
                  await catalogStore.deleteProduct(ean);
                }}
                onToggleFavorite={async (productId) => {
                  await catalogStore.toggleFavorite(productId);
                }}
                isFavorite={isFavorite(item.id)}
              />
            )}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          !isSearching && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {t('catalog.empty.noResults', { query: searchQuery })}
              </Text>
            </View>
          )
        )
      ) : collections.length > 0 ? (
        // Collections + normal list
        <SectionList
          sections={[
            ...collections.map((c) => ({ title: c.title, data: c.data })),
            { title: t('catalog.section.allProducts'), data: filteredProducts },
          ]}
          keyExtractor={(item) => item.ean}
          extraData={catalogStore.favorites}
          renderSectionHeader={({ section }) =>
            section.data.length > 0 ? (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => handleSelectProduct(item)}
              onDelete={async (ean) => {
                await catalogStore.deleteProduct(ean);
              }}
              onToggleFavorite={async (productId) => {
                await catalogStore.toggleFavorite(productId);
              }}
              isFavorite={isFavorite(item.id)}
            />
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
        />
      ) : // Normal flat list
      filteredProducts.length > 0 ? (
        <FlatList
          data={filteredProducts}
          extraData={catalogStore.favorites}
          keyExtractor={(item) => item.ean}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => handleSelectProduct(item)}
              onDelete={async (ean) => {
                await catalogStore.deleteProduct(ean);
              }}
              onToggleFavorite={async (productId) => {
                await catalogStore.toggleFavorite(productId);
              }}
              isFavorite={isFavorite(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {missingIngredientsOnly
              ? t('catalog.empty.noMissingIngredients')
              : filter === 'All'
                ? t('catalog.empty.noProducts')
                : t('catalog.empty.statusFilter', {
                    status: filter === 'Warning' ? t('catalog.filter.warning') : filter,
                  })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  header: {
    paddingTop: 32,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },
  searchToggle: { fontSize: 22, color: '#fff' },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchSpinner: { marginRight: 12 },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statNumber: { color: '#7C4DFF', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#999', fontSize: 10, fontWeight: '500', marginTop: 2 },

  // Sort
  sortContainer: { paddingHorizontal: 12, paddingBottom: 8 },
  sortOptions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  sortChipActive: { backgroundColor: '#7C4DFF', borderColor: '#7C4DFF' },
  sortChipText: { fontSize: 11, fontWeight: '600', color: '#999' },
  sortChipTextActive: { color: '#fff' },

  // Filter
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  filterChipActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#bbb' },
  filterChipTextActive: { color: '#fff' },
  needsIngredientsChip: {
    borderColor: '#FF9800',
    borderStyle: 'dashed',
  },
  needsIngredientsChipActive: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
    borderStyle: 'solid',
  },

  // Section
  sectionTitle: {
    color: '#7C4DFF',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // List
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingVertical: 8, paddingBottom: 32 },
});
