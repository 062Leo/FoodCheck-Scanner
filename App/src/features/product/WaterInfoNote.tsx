import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TranslateFn } from '../../i18n/useTranslation';
import type { WaterInfo } from '../../domain/product/waterInfo';
import { colors, radius, spacing, typography } from '../../ui/theme';

/** Neutral background note on a bottled water; not a finding, not part of the rating. */
export function WaterInfoNote({ info, t }: { info: WaterInfo; t: TranslateFn }) {
  const lines = [
    info.naturalMineral ? t('product.water.naturalMineral') : undefined,
    info.infantLabel ? t('product.water.infantLabel') : undefined,
    info.glass ? t('product.water.glass') : undefined,
    info.mineralPoor ? t('product.water.mineralPoor') : undefined,
    info.calciumRich ? t('product.water.calciumRich') : undefined,
    info.magnesiumRich ? t('product.water.magnesiumRich') : undefined,
    t('product.water.notDetectable'),
  ].filter((line): line is string => Boolean(line));
  const title = t('product.water.title');
  const notRated = t('product.water.notRated');
  const sources = t('product.water.sources');
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={[title, ...lines, notRated, sources].join(' ')}
      testID="water-note"
    >
      <Ionicons name="water-outline" size={24} color={colors.info} />
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {lines.map((line) => (
          <Text key={line} style={styles.body}>
            {line}
          </Text>
        ))}
        <Text style={styles.caption}>{notRated}</Text>
        <Text style={styles.caption}>{sources}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  text: { flex: 1, gap: spacing.xs },
  title: { ...typography.caption, color: colors.text, fontWeight: '700' },
  body: { ...typography.body, color: colors.text },
  caption: { ...typography.caption, color: colors.textSecondary },
});
