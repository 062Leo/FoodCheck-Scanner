import { StyleSheet, Text, View } from 'react-native';
import type { RedFlagFinding } from '../../types/ScanResult';
import type { TranslateFn } from '../../i18n/useTranslation';
import { formatNumber } from '../../i18n/useTranslation';
import type { SupportedLanguage } from '../../i18n/translations';
import { categoryLabel } from '../../i18n/categoryLabels';
import { getIngredientTranslation } from '../../domain/rules/ingredientTranslations';
import type { CheckDetail } from '../../domain/analysis/productChecks';
import { productRuleReason, productRuleSources } from '../filters/ruleTexts';
import { colors, radius, spacing, typography } from '../../ui/theme';

const OPERATORS = { gt: '>', lt: '<', eq: '=' } as const;

export function findingTitle(
  finding: RedFlagFinding,
  t: TranslateFn,
  language: SupportedLanguage
): string {
  if (finding.nutrient) return t(`nutrient.${finding.nutrient.key}`);
  if (finding.check) return checkTitle(finding.check, t, language);
  if (finding.company) return t('product.company.title', { name: finding.company.name });
  if (finding.productRule)
    return t('product.productRule.title', { name: finding.productRule.name });
  if (finding.canonicalKey) return getIngredientTranslation(finding.canonicalKey, language);
  return finding.ingredient;
}

function checkTitle(check: CheckDetail, t: TranslateFn, language: SupportedLanguage): string {
  if (check.key === 'ingredient_count') {
    const params = {
      count: check.count ?? 0,
      threshold: formatNumber(check.threshold ?? 0, language),
      operator: OPERATORS[check.operator ?? 'gt'],
    };
    return check.operator && check.operator !== 'gt'
      ? t('product.check.ingredient_count.titleRule', params)
      : t('product.check.ingredient_count.title', params);
  }
  if (check.key === 'pesticide_risk' && check.crop) {
    return t('product.check.pesticide_risk.title', { crop: t(`product.crop.${check.crop}`) });
  }
  return t(`product.check.${check.key}.title`);
}

function checkDetail(detail: CheckDetail, t: TranslateFn, language: SupportedLanguage): string {
  if (detail.key === 'water_not_mineral' && detail.waterKind) {
    return t(`product.check.water_not_mineral.${detail.waterKind}`);
  }
  if (detail.key === 'water_contaminants' && detail.exceeded?.length) {
    const values = detail.exceeded.map((item) =>
      t('product.check.water_contaminants.value', {
        mineral: t(`product.mineral.${item.mineral}`),
        value: formatNumber(item.value, language, 3),
        limit: formatNumber(item.limit, language, 3),
      })
    );
    return [t('product.check.water_contaminants.detail'), ...values].join('\n');
  }
  return t(`product.check.${detail.key}.detail`);
}

export function findingDetail(
  finding: RedFlagFinding,
  t: TranslateFn,
  language: SupportedLanguage
): string {
  if (finding.check) return checkDetail(finding.check, t, language);
  if (finding.company) return t('product.company.detail', { matched: finding.company.matched });
  if (finding.productRule) {
    const { reason, sources } = finding.productRule;
    const lines = [productRuleReason(reason, language)];
    if (sources.length > 0) {
      lines.push(
        t('product.productRule.source', { sources: productRuleSources(sources, language) })
      );
    }
    return lines.filter(Boolean).join('\n');
  }
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
