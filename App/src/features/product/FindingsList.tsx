import { StyleSheet, Text, View } from 'react-native';
import type { RedFlagFinding } from '../../types/ScanResult';
import type { TranslateFn } from '../../i18n/useTranslation';
import { formatNumber } from '../../i18n/useTranslation';
import type { SupportedLanguage } from '../../i18n/translations';
import { categoryLabel } from '../../i18n/categoryLabels';
import { getIngredientTranslation } from '../../domain/rules/ingredientTranslations';
import { colors, radius, spacing, typography } from '../../ui/theme';

const OPERATORS = { gt: '>', lt: '<', eq: '=' } as const;

export function findingTitle(
  finding: RedFlagFinding,
  t: TranslateFn,
  language: SupportedLanguage
): string {
  if (finding.nutrient) return t(`nutrient.${finding.nutrient.key}`);
  if (finding.canonicalKey) return getIngredientTranslation(finding.canonicalKey, language);
  return finding.ingredient;
}

function findingDetail(finding: RedFlagFinding, t: TranslateFn, language: SupportedLanguage) {
  if (!finding.nutrient) return categoryLabel(finding.category, t);
  const unit = finding.nutrient.key === 'energy-kcal_100g' ? 'kcal' : 'g';
  return t('product.nutrientFinding', {
    value: formatNumber(finding.nutrient.value, language),
    threshold: formatNumber(finding.nutrient.threshold, language),
    operator: OPERATORS[finding.nutrient.operator],
    unit,
  });
}

export function FindingsList({
  findings,
  t,
  language,
}: {
  findings: RedFlagFinding[];
  t: TranslateFn;
  language: SupportedLanguage;
}) {
  return (
    <View style={styles.list}>
      {findings.map((finding, index) => {
        const color = finding.severity === 'critical' ? colors.danger : colors.warning;
        const title = findingTitle(finding, t, language);
        const detail = findingDetail(finding, t, language);
        const severity = t(
          finding.severity === 'critical' ? 'product.severity.critical' : 'product.severity.warning'
        );
        return (
          <View
            key={`${finding.canonicalKey ?? finding.ingredient}-${index}`}
            style={[styles.item, { borderLeftColor: color }]}
            accessible
            accessibilityLabel={`${title}, ${detail}, ${severity}`}
          >
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.detail}>{detail}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderLeftWidth: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  title: { ...typography.bodyStrong, color: colors.text },
  detail: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
