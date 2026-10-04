import type { FilterRule } from '../../types/FilterRule';
import type { TranslateFn } from '../../i18n/useTranslation';
import { formatDate, formatNumber } from '../../i18n/useTranslation';
import type { SupportedLanguage } from '../../i18n/translations';
import { DEFAULT_INGREDIENT_LIMIT, isCheckKey } from '../../domain/analysis/productChecks';
import { parseCompanyData } from '../../domain/analysis/companyRules';
import { parseProductRuleData, type ProductRuleSource } from '../../domain/analysis/productRules';

const OPERATORS = { gt: '>', lt: '<', eq: '=' } as const;

/** Title of a check rule in the rule list, e.g. "Mehr als 5 Zutaten". */
export function checkRuleTitle(rule: FilterRule, t: TranslateFn, language: SupportedLanguage) {
  if (!isCheckKey(rule.key)) return rule.key;
  if (rule.key === 'ingredient_count') {
    const params = {
      threshold: formatNumber(rule.threshold ?? DEFAULT_INGREDIENT_LIMIT, language),
      operator: OPERATORS[rule.operator ?? 'gt'],
    };
    return rule.operator && rule.operator !== 'gt'
      ? t('filter.check.ingredient_count.titleRule', params)
      : t('filter.check.ingredient_count.title', params);
  }
  // The finding names the crop; the rule covers all of them.
  if (rule.key === 'pesticide_risk') return t('filter.check.pesticide_risk.title');
  return t(`product.check.${rule.key}.title`);
}

/** Short description of a check rule (the text shown with a finding). */
export function checkRuleDetail(rule: FilterRule, t: TranslateFn): string | undefined {
  if (!isCheckKey(rule.key)) return undefined;
  if (rule.key === 'pesticide_risk') return t('filter.check.pesticide_risk.detail');
  return t(`product.check.${rule.key}.detail`);
}

/** Why a check exists and when it applies. */
export function checkRuleExplanation(rule: FilterRule, t: TranslateFn): string | undefined {
  return isCheckKey(rule.key) ? t(`filter.check.${rule.key}.explanation`) : undefined;
}

/** "Marke/Konzern · 87 zugehörige Marken", or a note that only the name is known. */
export function companyRuleDetail(rule: FilterRule, t: TranslateFn): string {
  const count = parseCompanyData(rule.translations)?.names.length ?? 0;
  if (count === 0) return t('filter.company.describeNameOnly');
  return count === 1 ? t('filter.company.describeOne') : t('filter.company.describe', { n: count });
}

/** What a product rule applies to, e.g. "Wasser der Marke „Naturalis“ mit „Medium“ im Namen". */
export function productRuleScope(rule: FilterRule, t: TranslateFn): string | undefined {
  const data = parseProductRuleData(rule.translations);
  if (!data) return undefined;
  if (data.nameWords.length === 0) {
    return t(data.waterOnly ? 'filter.productRule.brand' : 'filter.productRule.brandAll', {
      brand: data.brand,
    });
  }
  return t(data.waterOnly ? 'filter.productRule.product' : 'filter.productRule.productAll', {
    brand: data.brand,
    words: data.nameWords.join(' '),
  });
}

/** The reason of a product rule in the UI language. */
export function productRuleReason(
  reason: { de: string; en: string },
  language: SupportedLanguage
): string {
  return (language === 'de' ? reason.de : reason.en) || reason.de || reason.en;
}

/** "t-online, 26.06.2025; Utopia, 05.08.2026" */
export function productRuleSources(
  sources: readonly ProductRuleSource[],
  language: SupportedLanguage
): string {
  return sources
    .map((source) => {
      const date = source.date ? formatDate(source.date, language) || source.date : '';
      return date ? `${source.title}, ${date}` : source.title;
    })
    .join('; ');
}
