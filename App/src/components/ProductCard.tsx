import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProductSummary } from '../types/Product';
import { formatDate, type TranslateFn } from '../i18n/useTranslation';
import type { SupportedLanguage } from '../i18n/translations';
import { displayProductName } from '../domain/product/productName';
import { IconButton } from '../ui/components';
import { StatusBadge, toStatus } from '../ui/status';
import { colors, radius, spacing, typography } from '../ui/theme';

interface ProductCardProps {
  product: ProductSummary;
  isFavorite: boolean;
  t: TranslateFn;
  language: SupportedLanguage;
  onOpen: (product: ProductSummary) => void;
  onToggleFavorite: (product: ProductSummary) => void;
  /** Long press: further actions (edit, delete). */
  onMore?: (product: ProductSummary) => void;
}

/** One product in the catalog or favorites list. */
export const ProductCard = memo(function ProductCard({
  product,
  isFavorite,
  t,
  language,
  onOpen,
  onToggleFavorite,
  onMore,
}: ProductCardProps) {
  const status = toStatus(product.rating);
  const name = displayProductName(product.name, t('product.unknown'));
  const meta = [product.brands, formatDate(product.last_seen_at ?? product.scanned_at, language)]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        onPress={() => onOpen(product)}
        onLongPress={onMore ? () => onMore(product) : undefined}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${t(`status.${status}`)}${meta ? `, ${meta}` : ''}`}
        accessibilityHint={onMore ? t('catalog.a11y.moreHint') : undefined}
      >
        {product.image_url ? (
          <Image
            source={{ uri: product.image_url }}
            style={styles.thumbnail}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.thumbnail, styles.placeholder]}>
            <Ionicons name="nutrition-outline" size={22} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          <StatusBadge status={status} t={t} compact />
        </View>
      </Pressable>
      <IconButton
        icon={isFavorite ? 'star' : 'star-outline'}
        color={isFavorite ? colors.favorite : colors.textSecondary}
        label={t(isFavorite ? 'a11y.favoriteRemove' : 'a11y.favoriteAdd')}
        selected={isFavorite}
        onPress={() => onToggleFavorite(product)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingRight: spacing.xs,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  thumbnail: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.bg },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 4 },
  name: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
});
