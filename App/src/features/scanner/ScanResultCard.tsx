import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TranslateFn } from '../../i18n/useTranslation';
import { displayProductName } from '../../domain/product/productName';
import { Button, IconButton } from '../../ui/components';
import { STATUS_ICONS, reasonText, statusLabel } from '../../ui/status';
import { colors, radius, spacing, typography } from '../../ui/theme';
import type { ScanCard } from './useScanSession';
import {
  hasAllergenMatch,
  matchAllergens,
  type EuAllergen,
} from '../../domain/allergens/allergenProfile';
import { allergenAnnouncement } from '../allergens/AllergenWarning';
import { useAllergenStore } from '../../store/allergenStore';

/** Text read out by screen readers when a scan result arrives. */
export function scanCardAnnouncement(
  card: ScanCard,
  t: TranslateFn,
  allergenProfile: readonly EuAllergen[] = []
): string {
  if (card.phase === 'loading') return t('scanner.searching', { ean: card.ean });
  if (card.phase === 'failed') {
    return card.reason === 'offline'
      ? t('scanner.offlineResult')
      : card.reason === 'not-found'
        ? t('scanner.notFoundResult')
        : t('scanner.errorResult');
  }
  const { product, rating } = card.data;
  const summary = t('scanner.cardA11y', {
    name: displayProductName(product.name, t('product.unknown')),
    status: statusLabel(rating.status, t),
    reason: rating.reasons.length > 0 ? reasonText(rating.reasons[0], t) : '',
  })
    .trim()
    .replace(/[.\s]+$/, '');
  // An allergen from the user's profile matters more than the rating, so it comes first.
  return [...allergenAnnouncement(matchAllergens(product, allergenProfile), t), summary].join('. ');
}

/** Result of the last scan, shown on top of the camera. */
export function ScanResultCard({
  card,
  t,
  onOpen,
  onAdd,
  onRetry,
  onClose,
}: {
  card: ScanCard;
  t: TranslateFn;
  onOpen: () => void;
  onAdd: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const allergenProfile = useAllergenStore((s) => s.profile);

  if (card.phase === 'loading') {
    return (
      <View style={styles.card} testID="scan-card">
        <View style={styles.row}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.body}>{t('scanner.searching', { ean: card.ean })}</Text>
        </View>
      </View>
    );
  }

  if (card.phase === 'failed') {
    const message =
      card.reason === 'offline'
        ? t('scanner.offlineResult')
        : card.reason === 'not-found'
          ? t('scanner.notFoundResult')
          : t('scanner.errorResult');
    return (
      <View style={styles.card} testID="scan-card">
        <View style={styles.row}>
          <Ionicons name="help-circle" size={28} color={colors.textMuted} />
          <View style={styles.flex}>
            <Text style={styles.body}>{message}</Text>
            <Text style={styles.caption}>{t('product.ean', { ean: card.ean })}</Text>
          </View>
          <IconButton icon="close" label={t('scanner.close')} onPress={onClose} />
        </View>
        {card.reason === 'not-found' ? (
          <Button title={t('product.addProduct')} icon="create-outline" onPress={onAdd} />
        ) : (
          <Button title={t('common.retry')} icon="refresh" variant="secondary" onPress={onRetry} />
        )}
      </View>
    );
  }

  const { product, rating } = card.data;
  const status = rating.status;
  const name = displayProductName(product.name, t('product.unknown'));
  const reason = rating.reasons.length > 0 ? reasonText(rating.reasons[0], t) : '';
  const allergenMatch = matchAllergens(product, allergenProfile);
  const allergenLines = allergenAnnouncement(allergenMatch, t);
  const allergenAlert = hasAllergenMatch(allergenMatch);

  return (
    <View
      style={[styles.card, styles.readyCard, { borderLeftColor: colors.status[status] }]}
      testID="scan-card"
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={scanCardAnnouncement(card, t, allergenProfile)}
        accessibilityHint={t('scanner.details')}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Ionicons name={STATUS_ICONS[status]} size={40} color={colors.status[status]} />
        <View style={styles.flex}>
          {allergenLines.map((line) => (
            <View key={line} style={styles.allergen} testID="scan-card-allergen">
              <Ionicons
                name={allergenAlert ? 'warning' : 'information-circle-outline'}
                size={20}
                color={allergenAlert ? colors.danger : colors.textSecondary}
              />
              <Text style={allergenAlert ? styles.allergenText : styles.allergenNote}>{line}</Text>
            </View>
          ))}
          <Text style={[styles.status, { color: colors.status[status] }]}>
            {statusLabel(status, t)}
          </Text>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          {reason ? (
            <Text style={styles.caption} numberOfLines={2}>
              {reason}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
      </Pressable>
      <View style={styles.closeCorner}>
        <IconButton icon="close" label={t('scanner.close')} onPress={onClose} size={20} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readyCard: { borderLeftWidth: 6, paddingRight: spacing.xxl + spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  status: { ...typography.subtitle },
  name: { ...typography.bodyStrong, color: colors.text },
  body: { ...typography.body, color: colors.text, flexShrink: 1 },
  caption: { ...typography.caption, color: colors.textMuted },
  closeCorner: { position: 'absolute', top: 0, right: 0 },
  allergen: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  allergenText: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  allergenNote: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
});
