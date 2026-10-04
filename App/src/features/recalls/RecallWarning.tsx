import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '../../types/Product';
import { formatDate, type TranslateFn } from '../../i18n/useTranslation';
import type { SupportedLanguage } from '../../i18n/translations';
import { findRecallMatches, type RecallMatch } from '../../domain/recalls/recallMatch';
import { useRecallStore } from '../../store/recallStore';
import { Button } from '../../ui/components';
import { colors, radius, spacing, typography } from '../../ui/theme';

export function openRecall(link: string): void {
  Linking.openURL(link).catch(() => undefined);
}

function MatchEntry({
  match,
  t,
  language,
}: {
  match: RecallMatch;
  t: TranslateFn;
  language: SupportedLanguage;
}) {
  const { recall } = match;
  const date = formatDate(new Date(recall.publishedAt).toISOString(), language);
  return (
    <View style={styles.entry}>
      <Text style={styles.recallTitle}>{recall.title}</Text>
      {recall.reason ? (
        <Text style={styles.line}>{t('recalls.reason', { reason: recall.reason })}</Text>
      ) : null}
      {date ? <Text style={styles.source}>{t('recalls.published', { date })}</Text> : null}
      <Button
        title={t('recalls.open')}
        icon="open-outline"
        variant="secondary"
        onPress={() => openRecall(recall.link)}
        accessibilityHint={t('recalls.openA11y', { title: recall.title })}
        style={styles.button}
      />
    </View>
  );
}

/**
 * On the product page: current warnings from lebensmittelwarnung.de that concern the
 * product. Shows nothing while the source is unavailable. Does not change the rating.
 */
export function RecallWarning({
  product,
  t,
  language,
}: {
  product: Product;
  t: TranslateFn;
  language: SupportedLanguage;
}) {
  const visible = useRecallStore((s) => s.visible);
  const recalls = useRecallStore((s) => s.recalls);
  const matches = useMemo(
    () => (visible ? findRecallMatches(product, recalls) : []),
    [visible, recalls, product]
  );
  if (matches.length === 0) return null;

  const byEan = matches.some((match) => match.kind === 'ean');
  const shown = byEan ? matches.filter((match) => match.kind === 'ean') : matches;
  const title = t(byEan ? 'recallWarning.eanTitle' : 'recallWarning.nameTitle');
  return (
    <View
      style={[styles.card, byEan ? styles.eanCard : styles.nameCard]}
      accessibilityRole="alert"
      testID="recall-warning"
    >
      <Ionicons name="megaphone-outline" size={26} color={byEan ? colors.danger : colors.warning} />
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {byEan ? null : <Text style={styles.line}>{t('recallWarning.nameHint')}</Text>}
        {shown.slice(0, 3).map((match) => (
          <MatchEntry key={match.recall.id} match={match} t={t} language={language} />
        ))}
        <Text style={styles.source}>{t('recallWarning.source')}</Text>
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
    padding: spacing.lg,
  },
  eanCard: { backgroundColor: colors.dangerSubtle, borderLeftColor: colors.danger },
  nameCard: { backgroundColor: colors.surface, borderLeftColor: colors.warning },
  text: { flex: 1, gap: spacing.sm },
  title: { ...typography.caption, color: colors.text, fontWeight: '700' },
  entry: { gap: spacing.xs },
  recallTitle: { ...typography.bodyStrong, color: colors.text },
  line: { ...typography.body, color: colors.text },
  source: { ...typography.caption, color: colors.textSecondary },
  button: { alignSelf: 'flex-start' },
});
