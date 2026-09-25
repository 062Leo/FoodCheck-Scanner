import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TranslateFn } from '../../i18n/useTranslation';
import { displayProductName } from '../../domain/product/productName';
import { Button, IconButton } from '../../ui/components';
import { STATUS_ICONS, reasonText, statusLabel } from '../../ui/status';
import { colors, radius, spacing, typography } from '../../ui/theme';
import type { ScanCard } from './useScanSession';

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
  if (card.phase === 'loading') {
    return (
      <View style={styles.card} accessibilityLiveRegion="polite" testID="scan-card">
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
      <View style={styles.card} accessibilityLiveRegion="polite" testID="scan-card">
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

  return (
    <View
      style={[styles.card, styles.readyCard, { borderLeftColor: colors.status[status] }]}
      accessibilityLiveRegion="polite"
      testID="scan-card"
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={t('scanner.cardA11y', {
          name,
          status: statusLabel(status, t),
          reason,
        })}
        accessibilityHint={t('scanner.details')}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Ionicons name={STATUS_ICONS[status]} size={40} color={colors.status[status]} />
        <View style={styles.flex}>
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
});
