import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TranslateFn } from '../../i18n/useTranslation';
import type { TranslationKey } from '../../i18n/translations';
import type { BadgeTone, ProductBadge } from '../../domain/product/productBadges';
import { colors, radius, spacing, typography } from '../../ui/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Text and outline colour per tone; every tone also has its own icon. */
const TONE_COLORS: Record<BadgeTone, string> = {
  positive: colors.accent,
  neutral: colors.textSecondary,
  warning: colors.warning,
  info: colors.info,
};

const TONE_ICONS: Record<BadgeTone, IconName> = {
  positive: 'checkmark-circle',
  neutral: 'remove-circle',
  warning: 'alert-circle',
  info: 'information-circle',
};

export function badgeText(badge: ProductBadge, t: TranslateFn): string {
  switch (badge.kind) {
    case 'organic':
      return badge.associations.length > 0
        ? t('product.badge.organicWith', { names: badge.associations.join(', ') })
        : t('product.badge.organic');
    case 'husbandry':
      return t('product.badge.husbandry', {
        level: badge.level,
        name: t(`product.badge.husbandry.${badge.level}` as TranslationKey),
      });
    default:
      return t(`product.badge.${badge.kind}` as TranslationKey);
  }
}

function badgeA11yLabel(badge: ProductBadge, text: string, t: TranslateFn): string {
  if (badge.kind === 'msc') return t('product.badge.a11y.msc');
  if (badge.kind === 'asc') return t('product.badge.a11y.asc');
  return t('product.badge.a11y', { label: text });
}

/** Compact, wrapping row of label badges below the product name. */
export function ProductBadges({ badges, t }: { badges: ProductBadge[]; t: TranslateFn }) {
  if (badges.length === 0) return null;
  return (
    <View style={styles.row} testID="product-badges">
      {badges.map((badge) => {
        const text = badgeText(badge, t);
        const color = TONE_COLORS[badge.tone];
        const icon = badge.kind === 'organic' ? 'leaf' : TONE_ICONS[badge.tone];
        return (
          <View
            key={text}
            style={[styles.badge, { borderColor: color }]}
            accessible
            accessibilityLabel={badgeA11yLabel(badge, text, t)}
          >
            <Ionicons name={icon} size={14} color={color} />
            <Text style={[styles.text, { color }]}>{text}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.surfaceSunken,
  },
  text: { ...typography.caption, fontWeight: '700' },
});
