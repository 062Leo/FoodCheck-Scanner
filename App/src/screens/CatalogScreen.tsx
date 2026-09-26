import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../i18n/useTranslation';
import type { TranslationKey } from '../i18n/translations';
import { useCatalogStore } from '../store/catalogStore';
import {
  CATALOG_SORTS,
  countCatalog,
  queryCatalog,
  type CatalogFilter,
  type CatalogSort,
} from '../domain/catalog/catalogQuery';
import { ProductCard } from '../components/ProductCard';
import { Toast } from '../components/Toast';
import { useProductListActions } from '../features/catalog/useProductListActions';
import { Button, Chip, EmptyState, IconButton, PageTitle } from '../ui/components';
import { colors, radius, spacing, typography, TOUCH_TARGET } from '../ui/theme';

const FILTERS: { filter: CatalogFilter; label: TranslationKey; color?: string }[] = [
  { filter: 'all', label: 'catalog.filter.all' },
  { filter: 'Critical', label: 'status.Critical', color: colors.status.Critical },
  { filter: 'Warning', label: 'status.Warning', color: colors.status.Warning },
  { filter: 'OK', label: 'status.OK', color: colors.status.OK },
  { filter: 'Unknown', label: 'status.Unknown', color: colors.status.Unknown },
  { filter: 'missingIngredients', label: 'catalog.filter.missingIngredients' },
];

const SORT_LABELS: Record<CatalogSort, TranslationKey> = {
  recent: 'catalog.sort.recent',
  rating: 'catalog.sort.rating',
  name: 'catalog.sort.name',
  nova: 'catalog.sort.nova',
  frequency: 'catalog.sort.frequency',
};

export default function CatalogScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const products = useCatalogStore((s) => s.products);
  const loadAll = useCatalogStore((s) => s.loadAll);
  const [loaded, setLoaded] = useState(products.length > 0);
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [sort, setSort] = useState<CatalogSort>('recent');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const actions = useProductListActions(t);

  // Refresh silently on every visit; the spinner only shows before the first load.
  useFocusEffect(
    useCallback(() => {
      void loadAll().finally(() => setLoaded(true));
    }, [loadAll])
  );

  const counts = useMemo(() => countCatalog(products), [products]);
  const visible = useMemo(
    () => queryCatalog(products, { filter, search, sort }),
    [products, filter, search, sort]
  );

  const closeSearch = () => {
    setSearch('');
    setSearchOpen(false);
  };

  const renderEmpty = () => {
    if (!loaded) return <ActivityIndicator style={styles.loader} color={colors.accent} />;
    if (products.length === 0) {
      return (
        <EmptyState
          icon="barcode-outline"
          title={t('catalog.empty.noProducts')}
          message={t('catalog.empty.noProductsHint')}
          action={
            <Button
              title={t('catalog.empty.scan')}
              icon="scan"
              onPress={() => router.navigate('/')}
            />
          }
        />
      );
    }
    return (
      <EmptyState
        icon="search-outline"
        title={search ? t('catalog.empty.noResults', { query: search }) : t('catalog.empty.filter')}
        action={
          <Button
            title={t('catalog.filter.reset')}
            variant="secondary"
            onPress={() => {
              setFilter('all');
              closeSearch();
            }}
          />
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      <PageTitle
        title={t('catalog.title')}
        right={
          <IconButton
            icon={searchOpen ? 'close' : 'search'}
            label={searchOpen ? t('catalog.search.close') : t('catalog.search.open')}
            onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          />
        }
      />

      {searchOpen && (
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('catalog.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoFocus
            returnKeyType="search"
            accessibilityLabel={t('catalog.search.open')}
            testID="catalog-search"
          />
        </View>
      )}

      {products.length > 0 && (
        <Text style={styles.summary}>
          {t('catalog.summary', {
            products:
              counts.all === 1
                ? t('catalog.summary.productsOne')
                : t('catalog.summary.products', { count: counts.all }),
            scans:
              counts.scans === 1
                ? t('catalog.summary.scansOne')
                : t('catalog.summary.scans', { count: counts.scans }),
            share: Math.round(counts.ultraProcessedShare * 100),
          })}
        </Text>
      )}

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {FILTERS.map(({ filter: option, label, color }) => (
            <Chip
              key={option}
              label={`${t(label)} ${counts[option]}`}
              selected={filter === option}
              color={color}
              onPress={() => setFilter(option)}
            />
          ))}
        </ScrollView>
      </View>

      <Pressable
        style={styles.sortRow}
        onPress={() => setSortOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('catalog.sort.a11y', { sort: t(SORT_LABELS[sort]) })}
      >
        <Ionicons name="swap-vertical" size={18} color={colors.textSecondary} />
        <Text style={styles.sortText}>{t(SORT_LABELS[sort])}</Text>
      </Pressable>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.ean}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            isFavorite={item.id !== undefined && actions.favoriteIds.has(item.id)}
            t={t}
            language={language}
            onOpen={actions.open}
            onToggleFavorite={actions.onToggleFavorite}
            onMore={actions.more}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        testID="catalog-list"
      />

      <Modal
        visible={sortOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSortOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle} accessibilityRole="header">
              {t('catalog.sort.title')}
            </Text>
            {CATALOG_SORTS.map((option) => (
              <Pressable
                key={option}
                style={({ pressed }) => [styles.sheetOption, pressed && styles.pressed]}
                onPress={() => {
                  setSort(option);
                  setSortOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: sort === option }}
              >
                <Text style={styles.sheetOptionText}>{t(SORT_LABELS[option])}</Text>
                {sort === option && <Ionicons name="checkmark" size={20} color={colors.accent} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {actions.toast && (
        <Toast
          message={actions.toast.message}
          type="info"
          action={{ label: t('common.undo'), onPress: actions.toast.undo }}
          onDismiss={actions.clearToast}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  searchInput: { ...typography.body, color: colors.text, flex: 1, minHeight: TOUCH_TARGET },
  summary: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
  },
  sortText: { ...typography.label, color: colors.textSecondary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  separator: { height: spacing.sm },
  loader: { marginTop: spacing.xxl },
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  sheetTitle: { ...typography.subtitle, color: colors.text, marginBottom: spacing.sm },
  sheetOption: {
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  sheetOptionText: { ...typography.body, color: colors.text },
});
