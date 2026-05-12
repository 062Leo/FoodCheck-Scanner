import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SectionList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from '../i18n/useTranslation';
import type { TranslationKey } from '../i18n/translations';
import {
  getIngredientTranslation,
  resolveIngredientKey,
  SEARCH_LANGUAGES,
} from '../domain/rules/ingredientTranslations';
import { MyMemoryClient } from '../infrastructure/translation/MyMemoryClient';
import { Ionicons } from '@expo/vector-icons';

import { useFilterStore } from '../store/filterStore';
import type {
  FilterRule,
  FilterRuleOperator,
  FilterRuleSeverity,
  FilterRuleType,
  NewFilterRule,
} from '../types/FilterRule';

const NUTRIENT_OPTIONS = [
  'sugars_100g',
  'fat_100g',
  'saturated-fat_100g',
  'salt_100g',
  'energy-kcal_100g',
] as const;
const OPERATOR_OPTIONS: FilterRuleOperator[] = ['gt', 'lt', 'eq'];

const CATEGORY_PRESETS = [
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

const ALL_CATEGORIES: readonly string[] = CATEGORY_PRESETS;

const CATEGORY_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  Süßungsmittel: 'filter.preset.sweeteners',
  Farbstoffe: 'filter.preset.colors',
  Konservierungsstoffe: 'filter.preset.preservatives',
  'Geschmacksverstärker & Aromen': 'filter.preset.flavorEnhancers',
  'Emulgatoren & Stabilisatoren': 'filter.preset.emulsifiers',
  'Verdickungs- & Geliermittel': 'filter.preset.thickeners',
  'Säuren & Säureregulatoren': 'filter.preset.acids',
  Antioxidationsmittel: 'filter.preset.antioxidants',
  'Gehärtete Fette & raffinierte Öle': 'filter.preset.hydrogenatedFats',
  'Zucker & Sirupe': 'filter.preset.sugarSyrups',
  'Modifizierte Stärken': 'filter.preset.modifiedStarches',
  'Phosphate & Mineralstoffe': 'filter.preset.phosphates',
  'Füll- & Trägerstoffe': 'filter.preset.fillers',
  'Proteine & Fleischersatz': 'filter.preset.proteins',
  'Trenn- & Überzugsmittel': 'filter.preset.releaseAgents',
  'Treib- & Schutzgase': 'filter.preset.propellantGases',
  Metalle: 'filter.preset.metals',
  'E-Nummern': 'filter.preset.eNumbers',
  'Sonstige Zusatzstoffe': 'filter.preset.other',
  'Ohne Kategorie': 'filter.uncategorized',
};

type RuleFormState = {
  type: FilterRuleType;
  ingredientKey: string;
  category: string;
  nutrientKey: (typeof NUTRIENT_OPTIONS)[number];
  operator: FilterRuleOperator;
  threshold: string;
  severity: FilterRuleSeverity;
};

const emptyFormState: RuleFormState = {
  type: 'ingredient',
  ingredientKey: '',
  category: '',
  nutrientKey: 'sugars_100g',
  operator: 'gt',
  threshold: '',
  severity: 'red_flag',
};

async function translateIngredient(text: string): Promise<string | null> {
  const client = new MyMemoryClient();
  const result: Record<string, string> = {};
  for (const lang of SEARCH_LANGUAGES) {
    try {
      const translated = await client.translate(text, lang.toUpperCase());
      if (translated && translated !== text) {
        result[lang] = translated;
      }
    } catch {
      // skip individual failures
    }
  }
  return Object.keys(result).length > 0 ? JSON.stringify(result) : null;
}

export default function FilterScreen() {
  const { t, language } = useTranslation();
  const rules = useFilterStore((state) => state.rules);
  const isLoading = useFilterStore((state) => state.isLoading);
  const loadRules = useFilterStore((state) => state.loadRules);
  const addRule = useFilterStore((state) => state.addRule);
  const updateRule = useFilterStore((state) => state.updateRule);
  const deleteRule = useFilterStore((state) => state.deleteRule);

  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false);
  const [isNutrientPickerVisible, setIsNutrientPickerVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<FilterRule | null>(null);
  const [formState, setFormState] = useState<RuleFormState>(emptyFormState);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(ALL_CATEGORIES)
  );
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const groupedRules = useMemo(() => {
    const groups: Record<string, FilterRule[]> = {};

    for (const cat of ALL_CATEGORIES) {
      groups[cat] = [];
    }

    for (const rule of rules) {
      const cat = rule.category || t('filter.uncategorized');
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(rule);
    }

    const rawEntries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return rawEntries;
    }

    return rawEntries
      .map(([category, categoryRules]) => {
        const translatedCat = t(
          CATEGORY_TRANSLATION_KEYS[category] ?? (category as TranslationKey)
        ).toLowerCase();
        const catMatch = category.toLowerCase().includes(q) || translatedCat.includes(q);
        const matchingRules = categoryRules.filter((rule) => {
          const displayKey =
            rule.type === 'ingredient'
              ? getIngredientTranslation(rule.key, language, rule.translations)
              : rule.key;
          return (
            rule.key.toLowerCase().includes(q) ||
            displayKey.toLowerCase().includes(q) ||
            rule.category.toLowerCase().includes(q) ||
            rule.type.toLowerCase().includes(q) ||
            rule.severity.toLowerCase().includes(q)
          );
        });
        return [category, catMatch ? categoryRules : matchingRules] as [string, FilterRule[]];
      })
      .filter(([, categoryRules]) => categoryRules.length > 0);
  }, [rules, searchQuery, language]);

  const sections = useMemo(
    () =>
      groupedRules.map(([category, categoryRules]) => ({
        title: category,
        data: collapsedCategories.has(category) ? [] : categoryRules,
        count: categoryRules.length,
      })),
    [groupedRules, collapsedCategories]
  );

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setFormState(emptyFormState);
    setIsEditorVisible(true);
  };

  const openEditModal = (rule: FilterRule) => {
    setEditingRule(rule);
    setFormState({
      type: rule.type,
      ingredientKey: rule.type === 'ingredient' ? rule.key : '',
      category: rule.category,
      nutrientKey: isNutrientOption(rule.key) ? rule.key : 'sugars_100g',
      operator: rule.operator ?? 'gt',
      threshold:
        rule.threshold !== null && rule.threshold !== undefined ? String(rule.threshold) : '',
      severity: rule.severity,
    });
    setIsEditorVisible(true);
  };

  const closeModal = () => {
    setIsEditorVisible(false);
    setIsCategoryPickerVisible(false);
    setIsNutrientPickerVisible(false);
  };

  const handleSave = async () => {
    const category = formState.category.trim();

    if (formState.type === 'ingredient') {
      const rawKey = formState.ingredientKey.trim();
      if (!rawKey) {
        Alert.alert(t('filter.missing'), t('filter.validation.ingredient'));
        return;
      }
      if (!category) {
        Alert.alert(t('filter.missing'), t('filter.validation.category'));
        return;
      }

      const canonicalKey = resolveIngredientKey(rawKey);
      let translations: string | null = null;

      if (canonicalKey === rawKey && !editingRule) {
        translations = await translateIngredient(rawKey);
      }

      const payload: NewFilterRule = {
        type: 'ingredient',
        key: canonicalKey,
        category,
        threshold: null,
        operator: null,
        severity: formState.severity,
        translations,
      };

      if (editingRule) {
        await updateRule(editingRule.id, payload);
      } else {
        await addRule(payload);
      }

      closeModal();
      return;
    }

    const thresholdValue = Number.parseFloat(formState.threshold.replace(',', '.'));
    if (Number.isNaN(thresholdValue)) {
      Alert.alert(t('filter.missing'), t('filter.validation.threshold'));
      return;
    }

    const payload: NewFilterRule = {
      type: 'nutrient',
      key: formState.nutrientKey,
      category: category || t('filter.defaultNutrientCategory'),
      threshold: thresholdValue,
      operator: formState.operator,
      severity: formState.severity,
    };

    if (editingRule) {
      await updateRule(editingRule.id, payload);
    } else {
      await addRule(payload);
    }

    closeModal();
  };

  const confirmDelete = (rule: FilterRule) => {
    const displayName =
      rule.type === 'ingredient'
        ? getIngredientTranslation(rule.key, language, rule.translations)
        : rule.key;
    Alert.alert(t('filter.deleteTitle'), t('filter.deleteMsg', { key: displayName }), [
      { text: t('edit.cancel'), style: 'cancel' },
      {
        text: t('filter.delete'),
        style: 'destructive',
        onPress: () => {
          void deleteRule(rule.id);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>{t('filter.title')}</Text>
          <Text style={styles.subtitle}>
            {t('filter.subtitle', { n: rules.length, m: groupedRules.length })}
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
          <Ionicons name="add" size={16} color="#0B0B0B" />
          <Text style={styles.addButtonText}>{t('filter.add')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#6B7280" style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('filter.searchPlaceholder')}
          placeholderTextColor="#6B7280"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.searchClear} onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {rules.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('filter.empty')}</Text>
          <Text style={styles.emptyText}>{t('filter.emptyHint')}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderSectionHeader={({ section }) => {
            const collapsed = collapsedCategories.has(section.title);
            return (
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => toggleCategory(section.title)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={collapsed ? 'chevron-forward' : 'chevron-down'}
                  size={14}
                  color="#9CA3AF"
                />
                <Text style={styles.categoryTitle} numberOfLines={1}>
                  {t(CATEGORY_TRANSLATION_KEYS[section.title] ?? (section.title as TranslationKey))}
                </Text>
                <View style={styles.categoryCount}>
                  <Text style={styles.categoryCountText}>{section.count}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          renderItem={({ item: rule }) => (
            <View style={styles.ruleRow}>
              <Pressable onPress={() => openEditModal(rule)} style={styles.ruleContent}>
                <Text style={styles.ruleKey} numberOfLines={1}>
                  {rule.type === 'ingredient'
                    ? getIngredientTranslation(rule.key, language, rule.translations)
                    : rule.key}
                </Text>
                <View style={styles.ruleBadges}>
                  <View
                    style={[
                      styles.ruleBadge,
                      rule.type === 'ingredient' ? styles.badgeIngredient : styles.badgeNutrient,
                    ]}
                  >
                    <Text style={styles.ruleBadgeText}>
                      {rule.type === 'ingredient'
                        ? t('filter.type.ingredient')
                        : t('filter.type.nutrient')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.ruleBadge,
                      rule.severity === 'red_flag' ? styles.badgeRed : styles.badgeOk,
                    ]}
                  >
                    <Text style={styles.ruleBadgeText}>
                      {rule.severity === 'red_flag'
                        ? t('filter.type.flag')
                        : t('filter.severity.ok')}
                    </Text>
                  </View>
                </View>
              </Pressable>
              <View style={styles.ruleActions}>
                <TouchableOpacity style={styles.iconButton} onPress={() => openEditModal(rule)}>
                  <Ionicons name="pencil-outline" size={14} color="#60A5FA" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => confirmDelete(rule)}>
                  <Ionicons name="trash-outline" size={14} color="#F87171" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          initialNumToRender={16}
          maxToRenderPerBatch={16}
          windowSize={3}
          removeClippedSubviews={true}
        />
      )}

      <Modal
        visible={isEditorVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRule ? t('filter.editRule') : t('filter.addRule')}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.tabRow}>
              <TabButton
                label={t('filter.tab.ingredient')}
                active={formState.type === 'ingredient'}
                onPress={() => setFormState((current) => ({ ...current, type: 'ingredient' }))}
              />
              <TabButton
                label={t('filter.tab.nutrient')}
                active={formState.type === 'nutrient'}
                onPress={() => setFormState((current) => ({ ...current, type: 'nutrient' }))}
              />
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formContent}
            >
              {formState.type === 'ingredient' ? (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('filter.field.keyword')}</Text>
                    <TextInput
                      value={formState.ingredientKey}
                      onChangeText={(value) =>
                        setFormState((current) => ({ ...current, ingredientKey: value }))
                      }
                      placeholder={t('filter.field.keywordPlaceholder')}
                      placeholderTextColor="#6B7280"
                      style={styles.input}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('filter.field.category')}</Text>
                    <TouchableOpacity
                      style={styles.selectButton}
                      onPress={() => setIsCategoryPickerVisible(true)}
                    >
                      <Text
                        style={[
                          styles.selectButtonText,
                          !formState.category && styles.selectButtonPlaceholder,
                        ]}
                      >
                        {formState.category
                          ? t(CATEGORY_TRANSLATION_KEYS[formState.category] ?? formState.category)
                          : t('filter.field.categoryPlaceholder')}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#D1D5DB" />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('filter.field.nutrient')}</Text>
                    <TouchableOpacity
                      style={styles.selectButton}
                      onPress={() => setIsNutrientPickerVisible(true)}
                    >
                      <Text style={styles.selectButtonText}>{formState.nutrientKey}</Text>
                      <Ionicons name="chevron-down" size={18} color="#D1D5DB" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('filter.field.operator')}</Text>
                    <View style={styles.segmentRow}>
                      {OPERATOR_OPTIONS.map((operator) => (
                        <SegmentButton
                          key={operator}
                          label={operator}
                          active={formState.operator === operator}
                          onPress={() => setFormState((current) => ({ ...current, operator }))}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('filter.field.threshold')}</Text>
                    <TextInput
                      value={formState.threshold}
                      onChangeText={(value) =>
                        setFormState((current) => ({ ...current, threshold: value }))
                      }
                      placeholder={t('filter.field.thresholdPlaceholder')}
                      placeholderTextColor="#6B7280"
                      style={styles.input}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('filter.field.categoryNutrient')}</Text>
                    <TextInput
                      value={formState.category}
                      onChangeText={(value) =>
                        setFormState((current) => ({ ...current, category: value }))
                      }
                      placeholder={t('filter.field.categoryNutrientPlaceholder')}
                      placeholderTextColor="#6B7280"
                      style={styles.input}
                      autoCapitalize="none"
                    />
                  </View>
                </>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('filter.field.severity')}</Text>
                <View style={styles.segmentRow}>
                  <SegmentButton
                    label={t('filter.severity.flag')}
                    active={formState.severity === 'red_flag'}
                    onPress={() =>
                      setFormState((current) => ({ ...current, severity: 'red_flag' }))
                    }
                  />
                  <SegmentButton
                    label={t('filter.severity.ok')}
                    active={formState.severity === 'ok'}
                    onPress={() => setFormState((current) => ({ ...current, severity: 'ok' }))}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={() => void handleSave()}>
                <Text style={styles.saveButtonText}>{t('filter.save')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isCategoryPickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsCategoryPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>{t('filter.picker.category')}</Text>
            <ScrollView style={styles.pickerScroll}>
              {CATEGORY_PRESETS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.pickerOption,
                    formState.category === option && styles.pickerOptionActive,
                  ]}
                  onPress={() => {
                    setFormState((current) => ({ ...current, category: option }));
                    setIsCategoryPickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      formState.category === option && styles.pickerOptionTextActive,
                    ]}
                  >
                    {t(CATEGORY_TRANSLATION_KEYS[option] ?? option)}
                  </Text>
                  {formState.category === option && (
                    <Ionicons name="checkmark" size={18} color="#A7F3D0" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsCategoryPickerVisible(false)}
            >
              <Text style={styles.cancelButtonText}>{t('edit.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isNutrientPickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsNutrientPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>{t('filter.picker.nutrient')}</Text>
            {NUTRIENT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.pickerOption}
                onPress={() => {
                  setFormState((current) => ({ ...current, nutrientKey: option }));
                  setIsNutrientPickerVisible(false);
                }}
              >
                <Text style={styles.pickerOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsNutrientPickerVisible(false)}
            >
              <Text style={styles.cancelButtonText}>{t('edit.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isLoading ? <Text style={styles.loadingHint}>{t('filter.loading')}</Text> : null}
    </View>
  );
}

function isNutrientOption(value: string): value is (typeof NUTRIENT_OPTIONS)[number] {
  return NUTRIENT_OPTIONS.includes(value as (typeof NUTRIENT_OPTIONS)[number]);
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    paddingTop: 32,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    color: '#9CA3AF',
    fontSize: 13,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#0B0B0B',
    fontWeight: '800',
    fontSize: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#303030',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 11,
  },
  searchClear: {
    padding: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginTop: 6,
    marginBottom: 2,
    backgroundColor: '#0D0D0D',
  },
  categoryTitle: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  categoryCount: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  categoryCountText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    marginBottom: 2,
    paddingRight: 4,
  },
  ruleContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingLeft: 12,
    gap: 8,
  },
  ruleKey: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  ruleBadges: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  ruleBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeIngredient: {
    backgroundColor: '#334155',
  },
  badgeNutrient: {
    backgroundColor: '#1D4ED8',
  },
  badgeRed: {
    backgroundColor: '#7F1D1D',
  },
  badgeOk: {
    backgroundColor: '#14532D',
  },
  ruleBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  ruleActions: {
    flexDirection: 'row',
    gap: 2,
    paddingLeft: 4,
    paddingVertical: 4,
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#2A2A2A',
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  tabButtonActive: {
    backgroundColor: '#A7F3D0',
    borderColor: '#A7F3D0',
  },
  tabButtonText: {
    color: '#B8B8B8',
    fontWeight: '700',
    fontSize: 12,
  },
  tabButtonTextActive: {
    color: '#0B0B0B',
  },
  formContent: {
    paddingBottom: 32,
    gap: 14,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#303030',
    color: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  selectButton: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#303030',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  selectButtonPlaceholder: {
    color: '#6B7280',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segmentButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#323232',
    backgroundColor: '#1A1A1A',
  },
  segmentButtonActive: {
    backgroundColor: '#A7F3D0',
    borderColor: '#A7F3D0',
  },
  segmentButtonText: {
    color: '#D1D5DB',
    fontWeight: '700',
    fontSize: 12,
  },
  segmentButtonTextActive: {
    color: '#0B0B0B',
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  pickerCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    maxHeight: '70%',
  },
  pickerScroll: {
    maxHeight: 360,
  },
  pickerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  pickerOption: {
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#232323',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerOptionActive: {
    backgroundColor: '#1A2E1A',
  },
  pickerOptionText: {
    color: '#E5E7EB',
    fontSize: 13,
  },
  pickerOptionTextActive: {
    color: '#A7F3D0',
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 6,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#1F1F1F',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  loadingHint: {
    color: '#9CA3AF',
    textAlign: 'center',
    paddingBottom: 14,
    fontSize: 12,
  },
});
