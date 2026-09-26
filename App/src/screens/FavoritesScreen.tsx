import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from '../i18n/useTranslation';
import { useCatalogStore } from '../store/catalogStore';
import { ProductCard } from '../components/ProductCard';
import { Toast } from '../components/Toast';
import { useProductListActions } from '../features/catalog/useProductListActions';
import { EmptyState, PageTitle } from '../ui/components';
import { colors, spacing } from '../ui/theme';

export default function FavoritesScreen() {
  const { t, language } = useTranslation();
  const favorites = useCatalogStore((s) => s.favorites);
  const loadAll = useCatalogStore((s) => s.loadAll);
  const [loaded, setLoaded] = useState(favorites.length > 0);
  const actions = useProductListActions(t);

  useFocusEffect(
    useCallback(() => {
      void loadAll().finally(() => setLoaded(true));
    }, [loadAll])
  );

  return (
    <View style={styles.container}>
      <PageTitle title={t('favorites.title')} />
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.ean}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            isFavorite
            t={t}
            language={language}
            onOpen={actions.open}
            onToggleFavorite={actions.onToggleFavorite}
            onMore={actions.more}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loaded ? (
            <EmptyState
              icon="star-outline"
              title={t('favorites.emptyTitle')}
              message={t('favorites.empty')}
            />
          ) : (
            <ActivityIndicator style={styles.loader} color={colors.accent} />
          )
        }
        contentContainerStyle={styles.list}
      />
      {actions.toast && (
        <Toast
          key={actions.toast.id}
          message={actions.toast.message}
          type={actions.toast.type}
          action={
            actions.toast.undo
              ? { label: t('common.undo'), onPress: actions.toast.undo }
              : undefined
          }
          onDismiss={actions.clearToast}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  separator: { height: spacing.sm },
  loader: { marginTop: spacing.xxl },
});
