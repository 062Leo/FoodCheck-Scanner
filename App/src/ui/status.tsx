import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RatingReason, ScanStatus } from '../types/ScanResult';
import type { TranslateFn } from '../i18n/useTranslation';
import { isScanStatus } from '../types/ScanResult';
import { colors, radius, spacing, typography } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Every status has its own icon, so it never depends on colour alone. */
export const STATUS_ICONS: Record<ScanStatus, IconName> = {
  OK: 'checkmark-circle',
  Warning: 'alert-circle',
  Critical: 'close-circle',
  Unknown: 'help-circle',
};

export function toStatus(value: string | null | undefined): ScanStatus {
  return isScanStatus(value) ? value : 'Unknown';
}

export function statusLabel(status: ScanStatus, t: TranslateFn): string {
  return t(`status.${status}`);
}

export function reasonText(reason: RatingReason, t: TranslateFn): string {
  switch (reason.code) {
    case 'nova':
      return t(reason.nova === 4 ? 'rating.reason.nova4' : 'rating.reason.nova3');
    case 'redFlags':
      return reason.count === 1
        ? t('rating.reason.redFlagsOne')
        : t('rating.reason.redFlagsMany', { count: reason.count });
    case 'ingredientsMissing':
      return t('rating.reason.ingredientsMissing');
    case 'insufficientData':
      return t('rating.reason.insufficientData');
    case 'noFindings':
      return t('rating.reason.noFindings');
  }
}

/** Compact status pill for lists: icon + text on a tinted background. */
export function StatusBadge({
  status,
  t,
  compact,
}: {
  status: ScanStatus;
  t: TranslateFn;
  compact?: boolean;
}) {
  const color = colors.status[status];
  return (
    <View
      style={[styles.badge, { borderColor: color }, compact && styles.badgeCompact]}
      accessible
      accessibilityLabel={statusLabel(status, t)}
    >
      <Ionicons name={STATUS_ICONS[status]} size={compact ? 14 : 16} color={color} />
      <Text style={[styles.badgeText, { color }]} numberOfLines={1}>
        {statusLabel(status, t)}
      </Text>
    </View>
  );
}

/** Large traffic-light banner at the top of the product screen. */
export function StatusHero({
  status,
  reasons,
  t,
  footnote,
}: {
  status: ScanStatus;
  reasons: RatingReason[];
  t: TranslateFn;
  footnote?: string;
}) {
  const background = colors.statusSolid[status];
  const foreground = colors.onStatusSolid[status];
  const lines = reasons.map((reason) => reasonText(reason, t));
  return (
    <View
      style={[styles.hero, { backgroundColor: background }]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={t('rating.a11ySummary', {
        status: statusLabel(status, t),
        reasons: [...lines, footnote].filter(Boolean).join('. '),
      })}
      testID="status-hero"
    >
      <View style={styles.heroTitleRow}>
        <Ionicons name={STATUS_ICONS[status]} size={36} color={foreground} />
        <Text style={[styles.heroTitle, { color: foreground }]}>{statusLabel(status, t)}</Text>
      </View>
      {lines.map((line) => (
        <Text key={line} style={[styles.heroReason, { color: foreground }]}>
          {line}
        </Text>
      ))}
      {footnote ? (
        <Text style={[styles.heroFootnote, { color: foreground }]}>{footnote}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.surfaceSunken,
  },
  badgeCompact: { paddingHorizontal: 6 },
  badgeText: { ...typography.caption, fontWeight: '700' },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroTitle: { ...typography.headline, flexShrink: 1 },
  heroReason: { ...typography.bodyStrong },
  heroFootnote: { ...typography.caption, marginTop: spacing.xs },
});
