import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  FilterRule,
  FilterRuleOperator,
  FilterRuleSeverity,
  NewFilterRule,
} from '../../types/FilterRule';
import type { NutrientKey } from '../../types/ScanResult';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TranslateFn } from '../../i18n/useTranslation';
import type { SupportedLanguage } from '../../i18n/translations';
import { categoryLabel } from '../../i18n/categoryLabels';
import { parseDecimal } from '../../domain/product/productForm';
import { resolveIngredientKey } from '../../domain/rules/ingredientTranslations';
import { DEFAULT_INGREDIENT_LIMIT } from '../../domain/analysis/productChecks';
import {
  COMPANY_CATEGORY,
  normalizeCompanyName,
  parseCompanyData,
  type CompanyData,
} from '../../domain/analysis/companyRules';
import { parseProductRuleData } from '../../domain/analysis/productRules';
import {
  checkRuleExplanation,
  checkRuleTitle,
  productRuleReason,
  productRuleScope,
  productRuleSources,
} from './ruleTexts';
import { CompanyRuleForm } from './CompanyRuleForm';
import { Button, Chip, IconButton } from '../../ui/components';
import { FormField } from '../../ui/FormField';
import { colors, radius, spacing, typography } from '../../ui/theme';

export const CATEGORY_PRESETS = [
  'Süßungsmittel',
  'Farbstoffe',
  'Konservierungsstoffe',
  'Geschmacksverstärker & Aromen',
  'Emulgatoren & Stabilisatoren',
  'Verdickungs- & Geliermittel',
  'Säuren & Säureregulatoren',
  'Antioxidationsmittel',
  'Gehärtete Fette & raffinierte Öle',
  'Zucker & Sirupe',
  'Modifizierte Stärken',
  'Phosphate & Mineralstoffe',
  'Füll- & Trägerstoffe',
  'Proteine & Fleischersatz',
  'Trenn- & Überzugsmittel',
  'Treib- & Schutzgase',
  'Metalle',
  'E-Nummern',
  'Sonstige Zusatzstoffe',
  'Gentechnik',
  'Insekten',
  'Samenöle',
  'Zuchtfisch',
  'Alkohol',
  'Erhitzte Milch',
  'Wasser',
] as const;

/** Stored category of nutrient rules (a fixed value, displayed translated). */
export const NUTRIENT_CATEGORY = 'Nährwerte';

export const NUTRIENTS: NutrientKey[] = [
  'sugars_100g',
  'fat_100g',
  'saturated-fat_100g',
  'salt_100g',
  'energy-kcal_100g',
];

const OPERATORS: FilterRuleOperator[] = ['gt', 'lt', 'eq'];
export const OPERATOR_SYMBOLS: Record<FilterRuleOperator, string> = { gt: '>', lt: '<', eq: '=' };

function isNutrientKey(key: string): key is NutrientKey {
  return (NUTRIENTS as string[]).includes(key);
}

interface FormState {
  /** 'check' and 'product' only when editing such a rule; they cannot be created here. */
  type: 'ingredient' | 'nutrient' | 'company' | 'check' | 'product';
  keyword: string;
  category: string;
  nutrient: NutrientKey;
  operator: FilterRuleOperator;
  threshold: string;
  severity: FilterRuleSeverity;
  companyName: string;
  companyData: CompanyData | null;
}

function initialState(rule: FilterRule | null): FormState {
  if (!rule) {
    return {
      type: 'ingredient',
      keyword: '',
      category: '',
      nutrient: 'sugars_100g',
      operator: 'gt',
      threshold: '',
      severity: 'red_flag',
      companyName: '',
      companyData: null,
    };
  }
  const isIngredientCount = rule.type === 'check' && rule.key === 'ingredient_count';
  return {
    type: rule.type,
    keyword: rule.type === 'ingredient' ? rule.key : '',
    category: rule.category,
    nutrient: isNutrientKey(rule.key) ? rule.key : 'sugars_100g',
    operator: rule.operator ?? 'gt',
    threshold:
      rule.threshold != null
        ? String(rule.threshold)
        : isIngredientCount
          ? String(DEFAULT_INGREDIENT_LIMIT)
          : '',
    severity: rule.severity,
    companyName: rule.type === 'company' ? rule.key : '',
    companyData: rule.type === 'company' ? parseCompanyData(rule.translations) : null,
  };
}

type FormError = 'ingredient' | 'category' | 'threshold' | 'count' | 'company' | 'duplicateCompany';

export type RuleChange =
  | { kind: 'add'; rule: NewFilterRule; translate: boolean }
  | { kind: 'update'; id: number; changes: Partial<NewFilterRule>; translate: boolean };

/**
 * Builds the change to store; returns an error key if the form is incomplete.
 * `rules` are the stored rules, used to refuse a second rule for the same company.
 */
export function buildRuleChange(
  editing: FilterRule | null,
  form: FormState,
  rules: readonly FilterRule[] = []
): RuleChange | { error: FormError } {
  // A check keeps its key and category; only the ingredient limit and severity change.
  // A product rule keeps its data; only the severity changes.
  if (editing?.type === 'product') {
    return {
      kind: 'update',
      id: editing.id,
      changes: { severity: form.severity },
      translate: false,
    };
  }
  if (editing?.type === 'check') {
    const changes: Partial<NewFilterRule> = { severity: form.severity };
    if (editing.key === 'ingredient_count') {
      const limit = form.threshold.trim();
      if (!/^\d+$/.test(limit) || Number(limit) < 1) return { error: 'count' };
      changes.threshold = Number(limit);
      changes.operator = 'gt';
    }
    return { kind: 'update', id: editing.id, changes, translate: false };
  }
  if (form.type === 'company') {
    const name = form.companyName.trim();
    if (!name) return { error: 'company' };
    const normalized = normalizeCompanyName(name) || name.toLowerCase();
    const duplicate = rules.some(
      (other) =>
        other.type === 'company' &&
        other.id !== editing?.id &&
        (normalizeCompanyName(other.key) || other.key.trim().toLowerCase()) === normalized
    );
    if (duplicate) return { error: 'duplicateCompany' };
    // The looked-up brands live in `translations`; company names are never translated.
    const rule: NewFilterRule = {
      type: 'company',
      key: name,
      category: COMPANY_CATEGORY,
      threshold: null,
      operator: null,
      severity: 'red_flag',
      translations: form.companyData ? JSON.stringify(form.companyData) : null,
    };
    return editing
      ? { kind: 'update', id: editing.id, changes: rule, translate: false }
      : { kind: 'add', rule, translate: false };
  }
  if (form.type === 'ingredient') {
    const raw = form.keyword.trim();
    if (!raw) return { error: 'ingredient' };
    if (!form.category) return { error: 'category' };
    const key = resolveIngredientKey(raw);
    // Keywords known to the built-in dictionary are already multilingual.
    const needsTranslation = key === raw && (!editing || editing.key !== key);
    const rule: NewFilterRule = {
      type: 'ingredient',
      key,
      category: form.category,
      threshold: null,
      operator: null,
      severity: form.severity,
    };
    if (!editing) return { kind: 'add', rule, translate: needsTranslation };
    // Keep stored translations unless the keyword itself changed.
    const changes: Partial<NewFilterRule> = { ...rule };
    if (editing.key !== key) changes.translations = null;
    return { kind: 'update', id: editing.id, changes, translate: needsTranslation };
  }

  const threshold = parseDecimal(form.threshold);
  // "<5" is valid for product values, but a rule states its comparison with the operator.
  if (!threshold || threshold.lessThan) return { error: 'threshold' };
  const rule: NewFilterRule = {
    type: 'nutrient',
    key: form.nutrient,
    category: editing?.type === 'nutrient' ? editing.category : NUTRIENT_CATEGORY,
    threshold: threshold.value,
    operator: form.operator,
    severity: form.severity,
    translations: null,
  };
  return editing
    ? { kind: 'update', id: editing.id, changes: rule, translate: false }
    : { kind: 'add', rule, translate: false };
}

export function RuleEditorSheet({
  visible,
  rule,
  rules = [],
  t,
  language,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  visible: boolean;
  rule: FilterRule | null;
  /** All stored rules, for the duplicate check. */
  rules?: readonly FilterRule[];
  t: TranslateFn;
  language: SupportedLanguage;
  saving: boolean;
  onSave: (change: RuleChange) => void;
  onDelete: (rule: FilterRule) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<FormState>(() => initialState(rule));
  const [error, setError] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm(initialState(rule));
      setError(null);
    }
  }, [visible, rule]);

  const update = useCallback(
    (changes: Partial<FormState>) => setForm((previous) => ({ ...previous, ...changes })),
    []
  );

  const save = () => {
    const change = buildRuleChange(rule, form, rules);
    if ('error' in change) {
      setError(t(`filter.validation.${change.error}`));
      return;
    }
    onSave(change);
  };

  const unit = form.nutrient === 'energy-kcal_100g' ? 'kcal' : 'g';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel={t('edit.cancel')} />
        <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {rule ? t('filter.editRule') : t('filter.addRule')}
            </Text>
            <IconButton icon="close" label={t('edit.cancel')} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {!rule && (
              <View style={styles.row}>
                <Chip
                  label={t('filter.tab.ingredient')}
                  selected={form.type === 'ingredient'}
                  onPress={() => update({ type: 'ingredient' })}
                />
                <Chip
                  label={t('filter.tab.nutrient')}
                  selected={form.type === 'nutrient'}
                  onPress={() => update({ type: 'nutrient' })}
                />
                <Chip
                  label={t('filter.tab.company')}
                  selected={form.type === 'company'}
                  onPress={() => update({ type: 'company' })}
                />
              </View>
            )}

            {rule?.type === 'check' ? (
              <>
                <Text style={styles.ruleTitle}>{checkRuleTitle(rule, t, language)}</Text>
                <Text style={styles.explanation}>{checkRuleExplanation(rule, t)}</Text>
                {rule.key === 'ingredient_count' ? (
                  <FormField
                    label={t('filter.check.threshold')}
                    value={form.threshold}
                    onChangeText={(threshold) => update({ threshold })}
                    keyboardType="number-pad"
                    testID="rule-check-threshold"
                  />
                ) : null}
                <Text style={styles.hint}>{t('filter.check.noDelete')}</Text>
              </>
            ) : rule?.type === 'product' ? (
              <ProductRuleInfo rule={rule} t={t} language={language} />
            ) : form.type === 'company' ? (
              <CompanyRuleForm
                name={form.companyName}
                data={form.companyData}
                language={language}
                t={t}
                onChange={update}
                onBusyChange={setLookupBusy}
              />
            ) : form.type === 'ingredient' ? (
              <>
                <FormField
                  label={t('filter.field.keyword')}
                  value={form.keyword}
                  onChangeText={(keyword) => update({ keyword })}
                  placeholder={t('filter.field.keywordPlaceholder')}
                  hint={t('filter.keywordHint')}
                  testID="rule-keyword"
                />
                <Text style={styles.label}>{t('filter.field.category')}</Text>
                <View style={styles.wrap}>
                  {CATEGORY_PRESETS.map((category) => (
                    <Chip
                      key={category}
                      label={categoryLabel(category, t)}
                      selected={form.category === category}
                      onPress={() => update({ category })}
                    />
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>{t('filter.field.nutrient')}</Text>
                <View style={styles.wrap}>
                  {NUTRIENTS.map((nutrient) => (
                    <Chip
                      key={nutrient}
                      label={t(`nutrient.${nutrient}`)}
                      selected={form.nutrient === nutrient}
                      onPress={() => update({ nutrient })}
                    />
                  ))}
                </View>
                <Text style={styles.label}>{t('filter.field.operator')}</Text>
                <View style={styles.row}>
                  {OPERATORS.map((operator) => (
                    <Chip
                      key={operator}
                      label={t(`filter.operator.${operator}`)}
                      selected={form.operator === operator}
                      onPress={() => update({ operator })}
                    />
                  ))}
                </View>
                <FormField
                  label={`${t('filter.field.threshold')} (${unit} ${t('product.nutritionPer100g')})`}
                  value={form.threshold}
                  onChangeText={(threshold) => update({ threshold })}
                  keyboardType="decimal-pad"
                  placeholder={t('filter.field.thresholdPlaceholder')}
                  testID="rule-threshold"
                />
              </>
            )}

            {/* A company match always rates the product critical (see the hint above). */}
            {form.type !== 'company' && (
              <>
                <Text style={styles.label}>{t('filter.field.severity')}</Text>
                <View style={styles.row}>
                  <Chip
                    label={t('filter.severity.flag')}
                    selected={form.severity === 'red_flag'}
                    color={colors.status.Critical}
                    onPress={() => update({ severity: 'red_flag' })}
                  />
                  <Chip
                    label={t('filter.severity.ok')}
                    selected={form.severity === 'ok'}
                    onPress={() => update({ severity: 'ok' })}
                  />
                </View>
                <Text style={styles.hint}>
                  {form.severity === 'red_flag'
                    ? t('filter.severity.flagHint')
                    : form.type === 'check'
                      ? t('filter.check.okHint')
                      : form.type === 'product'
                        ? t('filter.productRule.okHint')
                        : t('filter.severity.okHint')}
                </Text>
              </>
            )}

            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            {/* A deleted check could not be restored; checks are switched off instead. */}
            {rule && rule.type !== 'check' && (
              <Button
                title={t('filter.delete')}
                variant="danger"
                icon="trash-outline"
                onPress={() => onDelete(rule)}
                disabled={saving}
                style={styles.flex}
              />
            )}
            <Button
              title={t('filter.save')}
              icon="checkmark"
              onPress={save}
              loading={saving}
              disabled={lookupBusy}
              style={styles.flex}
              testID="rule-save"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Read-only view of a product rule: what it applies to, why, and the sources. */
function ProductRuleInfo({
  rule,
  t,
  language,
}: {
  rule: FilterRule;
  t: TranslateFn;
  language: SupportedLanguage;
}) {
  const data = parseProductRuleData(rule.translations);
  return (
    <>
      <Text style={styles.ruleTitle}>{rule.key}</Text>
      <Text style={styles.hint}>{productRuleScope(rule, t)}</Text>
      {data ? (
        <>
          <Text style={styles.label}>{t('filter.productRule.reason')}</Text>
          <Text style={styles.explanation}>{productRuleReason(data.reason, language)}</Text>
          {data.sources.length > 0 ? (
            <>
              <Text style={styles.label}>{t('filter.productRule.sources')}</Text>
              {data.sources.map((source) => (
                <Text key={source.url} style={styles.hint} selectable>
                  {`${productRuleSources([source], language)}\n${source.url}`}
                </Text>
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingTop: spacing.xs,
  },
  title: { ...typography.title, color: colors.text },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md },
  label: { ...typography.label, color: colors.textSecondary },
  ruleTitle: { ...typography.bodyStrong, color: colors.text },
  explanation: { ...typography.body, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { ...typography.body, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
});
