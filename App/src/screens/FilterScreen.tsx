import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { FilterRule } from '../types/FilterRule';
import { useFilterStore } from '../store/filterStore';
import { useTranslation, formatNumber } from '../i18n/useTranslation';
import { categoryLabel } from '../i18n/categoryLabels';
import { getIngredientTranslation } from '../domain/rules/ingredientTranslations';
import { groupRules } from '../domain/rules/ruleGroups';
import { translateRuleKeyword } from '../services/RuleTranslationService';
import {
  OPERATOR_SYMBOLS,
  RuleEditorSheet,
  type RuleChange,
} from '../features/filters/RuleEditorSheet';
import { Toast } from '../components/Toast';
import { Button, EmptyState, IconButton, ScreenHeader } from '../ui/components';
import { colors, radius, spacing, typography, TOUCH_TARGET } from '../ui/theme';

export default function FilterScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const rules = useFilterStore((s) => s.rules);
  const isInitialized = useFilterStore((s) => s.isInitialized);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<{ rule: FilterRule | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    void useFilterStore.getState().loadRules();
  }, []);

  const ruleLabel = useCallback(
    (rule: FilterRule) =>
      rule.type === 'nutrient'
        ? t(`nutrient.${rule.key}` as 'nutrient.sugars_100g')
        : getIngredientTranslation(rule.key, language, rule.translations),
    [language, t]
  );

  const groups = useMemo(
    () =>
      groupRules(rules, {
        query,
        categoryLabel: (category) => categoryLabel(category, t),
        ruleLabel,
        uncategorized: t('filter.uncategorized'),
      }),
    [rules, query, ruleLabel, t]
  );

  // While searching, every group with a match is open.
  const isOpen = (category: string) => query.trim().length > 0 || expanded.has(category);
  const sections = groups.map((group) => ({
    key: group.category,
    title: group.label,
    count: group.rules.length,
    data: isOpen(group.category) ? group.rules : [],
  }));

  const toggle = (category: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  const describe = (rule: FilterRule) => {
    if (rule.type === 'nutrient' && rule.operator && rule.threshold != null) {
      const unit = rule.key === 'energy-kcal_100g' ? 'kcal' : 'g';
      return `${OPERATOR_SYMBOLS[rule.operator]} ${formatNumber(rule.threshold, language)} ${unit} ${t('product.nutritionPer100g')}`;
    }
    return rule.key !== ruleLabel(rule) ? rule.key : undefined;
  };

  const save = async (change: RuleChange) => {
    setSaving(true);
    const store = useFilterStore.getState();
    try {
      let ok: boolean;
      if (change.kind === 'add') {
        const translations = change.translate ? await translateRuleKeyword(change.rule.key) : null;
        ok = await store.addRule({ ...change.rule, translations });
      } else {
        const changes = change.translate
          ? {
              ...change.changes,
              translations: await translateRuleKeyword(change.changes.key ?? ''),
            }
          : change.changes;
        ok = await store.updateRule(change.id, changes);
      }
      if (ok) {
        setEditor(null);
        setToast({ message: t('filter.saved'), type: 'success' });
      } else {
        setToast({ message: t('filter.saveFailed'), type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = (rule: FilterRule) => {
    Alert.alert(t('filter.deleteTitle'), t('filter.deleteMsg', { key: ruleLabel(rule) }), [
      { text: t('edit.cancel'), style: 'cancel' },
      {
        text: t('filter.delete'),
        style: 'destructive',
        onPress: async () => {
          const ok = await useFilterStore.getState().deleteRule(rule.id);
          if (ok) setEditor(null);
          else setToast({ message: t('filter.saveFailed'), type: 'error' });
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('filter.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
        right={
          <IconButton
            icon="add"
            label={t('filter.addRule')}
            onPress={() => setEditor({ rule: null })}
          />
        }
      />
      <Text style={styles.intro}>
        {rules.length === 1 ? t('filter.introOne') : t('filter.intro', { n: rules.length })}
      </Text>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('filter.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          accessibilityLabel={t('filter.searchPlaceholder')}
          testID="rule-search"
        />
        {query ? (
          <IconButton
            icon="close-circle"
            label={t('catalog.search.close')}
            onPress={() => setQuery('')}
            size={20}
          />
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(rule) => String(rule.id)}
        stickySectionHeadersEnabled={false}
        // Header and footer of every collapsed category fit into the first render.
        initialNumToRender={48}
        renderSectionHeader={({ section }) => (
          <Pressable
            onPress={() => toggle(section.key)}
            style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen(section.key) }}
            accessibilityLabel={`${section.title}, ${section.count}`}
          >
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.count}>{section.count}</Text>
            <Ionicons
              name={isOpen(section.key) ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        )}
        renderItem={({ item }) => {
          const detail = describe(item);
          return (
            <Pressable
              onPress={() => setEditor({ rule: item })}
              style={({ pressed }) => [styles.rule, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityHint={t('filter.editRule')}
            >
              <View style={styles.ruleText}>
                <Text style={styles.ruleName}>{ruleLabel(item)}</Text>
                {detail ? <Text style={styles.ruleDetail}>{detail}</Text> : null}
              </View>
              <Text
                style={[
                  styles.severity,
                  { color: item.severity === 'ok' ? colors.accent : colors.status.Critical },
                ]}
              >
                {item.severity === 'ok' ? t('filter.severity.ok') : t('filter.severity.flag')}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          isInitialized ? (
            <EmptyState
              icon="options-outline"
              title={query ? t('catalog.empty.noResults', { query }) : t('filter.empty')}
              action={
                query ? undefined : (
                  <Button
                    title={t('filter.addRule')}
                    icon="add"
                    onPress={() => setEditor({ rule: null })}
                  />
                )
              }
            />
          ) : null
        }
        contentContainerStyle={styles.list}
      />

      <RuleEditorSheet
        visible={editor !== null}
        rule={editor?.rule ?? null}
        t={t}
        saving={saving}
        onSave={(change) => void save(change)}
        onDelete={remove}
        // Closing while saving would look like cancel although the save still completes.
        onClose={() => {
          if (!saving) setEditor(null);
        }}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  intro: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.lg,
    marginBottom: spacing.sm,
    paddingLeft: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  searchInput: { ...typography.body, color: colors.text, flex: 1, minHeight: TOUCH_TARGET },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  sectionHeader: {
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.surface },
  sectionTitle: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  count: { ...typography.label, color: colors.textMuted },
  rule: {
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
  },
  ruleText: { flex: 1, gap: 2 },
  ruleName: { ...typography.body, color: colors.text },
  ruleDetail: { ...typography.caption, color: colors.textMuted },
  severity: { ...typography.label },
});
