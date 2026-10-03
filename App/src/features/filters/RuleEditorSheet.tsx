import { useEffect, useState } from 'react';
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
import { categoryLabel } from '../../i18n/categoryLabels';
import { parseDecimal } from '../../domain/product/productForm';
import { resolveIngredientKey } from '../../domain/rules/ingredientTranslations';
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
  type: 'ingredient' | 'nutrient';
  keyword: string;
  category: string;
  nutrient: NutrientKey;
  operator: FilterRuleOperator;
  threshold: string;
  severity: FilterRuleSeverity;
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
    };
  }
  return {
    // Check and company rules have no form of their own yet; see buildRuleChange.
    type: rule.type === 'nutrient' ? 'nutrient' : 'ingredient',
    keyword: rule.type === 'ingredient' ? rule.key : '',
    category: rule.category,
    nutrient: isNutrientKey(rule.key) ? rule.key : 'sugars_100g',
    operator: rule.operator ?? 'gt',
    threshold: rule.threshold != null ? String(rule.threshold) : '',
    severity: rule.severity,
  };
}

export type RuleChange =
  | { kind: 'add'; rule: NewFilterRule; translate: boolean }
  | { kind: 'update'; id: number; changes: Partial<NewFilterRule>; translate: boolean };

/** Builds the change to store; returns an error key if the form is incomplete. */
export function buildRuleChange(
  editing: FilterRule | null,
  form: FormState
): RuleChange | { error: 'ingredient' | 'category' | 'threshold' } {
  // Check and company rules are not edited here; only their severity can change.
  if (editing && (editing.type === 'check' || editing.type === 'company')) {
    return {
      kind: 'update',
      id: editing.id,
      changes: { severity: form.severity },
      translate: false,
    };
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
  t,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  visible: boolean;
  rule: FilterRule | null;
  t: TranslateFn;
  saving: boolean;
  onSave: (change: RuleChange) => void;
  onDelete: (rule: FilterRule) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<FormState>(() => initialState(rule));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setForm(initialState(rule));
      setError(null);
    }
  }, [visible, rule]);

  const update = (changes: Partial<FormState>) =>
    setForm((previous) => ({ ...previous, ...changes }));

  const save = () => {
    const change = buildRuleChange(rule, form);
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
              </View>
            )}

            {form.type === 'ingredient' ? (
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
              {form.severity === 'ok' ? t('filter.severity.okHint') : t('filter.severity.flagHint')}
            </Text>

            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            {rule && (
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
              style={styles.flex}
              testID="rule-save"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  hint: { ...typography.caption, color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { ...typography.body, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
});
