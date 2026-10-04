import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TranslateFn } from '../../i18n/useTranslation';
import type { AlmondOrigin } from '../../domain/product/almondInfo';
import { colors, radius, spacing, typography } from '../../ui/theme';

/** Neutral background note on Californian almonds; not a finding, not part of the rating. */
export function AlmondPollinationNote({ origin, t }: { origin: AlmondOrigin; t: TranslateFn }) {
  const lines = [
    t('product.almond.body'),
    origin === 'unknown' ? t('product.almond.unknownOrigin') : undefined,
  ].filter((line): line is string => Boolean(line));
  const title = t('product.almond.title');
  const notRated = t('product.almond.notRated');
  const sources = t('product.almond.sources');
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={[title, ...lines, notRated, sources].join(' ')}
      testID="almond-note"
    >
      <Ionicons name="information-circle-outline" size={24} color={colors.info} />
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
