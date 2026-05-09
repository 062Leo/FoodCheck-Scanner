import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useFilterStore } from '../../store/filterStore';
import type { FilterRule, FilterRuleOperator, FilterRuleSeverity, FilterRuleType, NewFilterRule } from '../../types/FilterRule';

const NUTRIENT_OPTIONS = ['sugars_100g', 'fat_100g', 'saturated-fat_100g', 'salt_100g', 'energy-kcal_100g'] as const;
const OPERATOR_OPTIONS: FilterRuleOperator[] = ['gt', 'lt', 'eq'];

type FilterMode = 'ingredient' | 'nutrient';

type RuleFormState = {
  type: FilterMode;
  ingredientKey: string;
  nutrientKey: (typeof NUTRIENT_OPTIONS)[number];
  operator: FilterRuleOperator;
  threshold: string;
  severity: FilterRuleSeverity;
};

const emptyFormState: RuleFormState = {
  type: 'ingredient',
  ingredientKey: '',
  nutrientKey: 'sugars_100g',
  operator: 'gt',
  threshold: '',
  severity: 'red_flag',
};

export default function FilterScreen() {
  const rules = useFilterStore((state) => state.rules);
  const isLoading = useFilterStore((state) => state.isLoading);
  const loadRules = useFilterStore((state) => state.loadRules);
  const addRule = useFilterStore((state) => state.addRule);
  const updateRule = useFilterStore((state) => state.updateRule);
  const deleteRule = useFilterStore((state) => state.deleteRule);

  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [isNutrientPickerVisible, setIsNutrientPickerVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<FilterRule | null>(null);
  const [formState, setFormState] = useState<RuleFormState>(emptyFormState);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

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
      nutrientKey: isNutrientOption(rule.key) ? rule.key : 'sugars_100g',
      operator: rule.operator ?? 'gt',
      threshold: rule.threshold !== null && rule.threshold !== undefined ? String(rule.threshold) : '',
      severity: rule.severity,
    });
    setIsEditorVisible(true);
  };

  const closeModal = () => {
    setIsEditorVisible(false);
    setIsNutrientPickerVisible(false);
  };

  const handleSave = async () => {
    if (formState.type === 'ingredient') {
      const key = formState.ingredientKey.trim();
      if (!key) {
        Alert.alert('Fehlt', 'Bitte einen Zutatenbegriff eingeben.');
        return;
      }

      const payload: NewFilterRule = {
        type: 'ingredient',
        key,
        threshold: null,
        operator: null,
        severity: formState.severity,
      };

      if (editingRule) {
        await updateRule(editingRule.id, payload);
      } else {
        await addRule({
          ...payload,
          created_at: new Date().toISOString(),
        });
      }

      closeModal();
      return;
    }

    const thresholdValue = Number.parseFloat(formState.threshold.replace(',', '.'));
    if (Number.isNaN(thresholdValue)) {
      Alert.alert('Fehlt', 'Bitte einen gültigen Grenzwert eingeben.');
      return;
    }

    const payload: NewFilterRule = {
      type: 'nutrient',
      key: formState.nutrientKey,
      threshold: thresholdValue,
      operator: formState.operator,
      severity: formState.severity,
    };

    if (editingRule) {
      await updateRule(editingRule.id, payload);
    } else {
      await addRule({
        ...payload,
        created_at: new Date().toISOString(),
      });
    }

    closeModal();
  };

  const confirmDelete = (rule: FilterRule) => {
    Alert.alert('Regel löschen?', `${rule.key} wirklich entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
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
        <View>
          <Text style={styles.title}>Filter-Regeln</Text>
          <Text style={styles.subtitle}>Ingredient- und Nährwertregeln verwalten</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
          <Ionicons name="add" size={18} color="#0B0B0B" />
          <Text style={styles.addButtonText}>Add Rule</Text>
        </TouchableOpacity>
      </View>

      {rules.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Noch keine Regeln</Text>
          <Text style={styles.emptyText}>Füge eine Ingredient- oder Nutrient-Regel hinzu.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {rules.map((rule) => (
            <Pressable key={rule.id} onPress={() => openEditModal(rule)} style={styles.ruleCard}>
              <View style={styles.ruleMainRow}>
                <View style={styles.ruleTextBlock}>
                  <Text style={styles.ruleKey}>{rule.key}</Text>
                  <Text style={styles.ruleMeta}>{describeRule(rule)}</Text>
                </View>
                <View style={styles.badgesRow}>
                  <View style={[styles.badge, rule.type === 'ingredient' ? styles.badgeIngredient : styles.badgeNutrient]}>
                    <Text style={styles.badgeText}>{rule.type === 'ingredient' ? 'INGREDIENT' : 'NUTRIENT'}</Text>
                  </View>
                  <View style={[styles.badge, rule.severity === 'red_flag' ? styles.badgeRed : styles.badgeOk]}>
                    <Text style={styles.badgeText}>{rule.severity === 'red_flag' ? 'RED FLAG' : 'OK'}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={(event) => {
                  event.stopPropagation();
                  confirmDelete(rule);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#F87171" />
              </TouchableOpacity>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={isEditorVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingRule ? 'Regel bearbeiten' : 'Regel hinzufügen'}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.tabRow}>
              <TabButton label="Ingredient Rule" active={formState.type === 'ingredient'} onPress={() => setFormState((current) => ({ ...current, type: 'ingredient' }))} />
              <TabButton label="Nutrient Rule" active={formState.type === 'nutrient'} onPress={() => setFormState((current) => ({ ...current, type: 'nutrient' }))} />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
              {formState.type === 'ingredient' ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Ingredient keyword</Text>
                  <TextInput
                    value={formState.ingredientKey}
                    onChangeText={(value) => setFormState((current) => ({ ...current, ingredientKey: value }))}
                    placeholder="z. B. palmöl"
                    placeholderTextColor="#6B7280"
                    style={styles.input}
                    autoCapitalize="none"
                  />
                </View>
              ) : (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Nutrient</Text>
                    <TouchableOpacity style={styles.selectButton} onPress={() => setIsNutrientPickerVisible(true)}>
                      <Text style={styles.selectButtonText}>{formState.nutrientKey}</Text>
                      <Ionicons name="chevron-down" size={18} color="#D1D5DB" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Operator</Text>
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
                    <Text style={styles.fieldLabel}>Threshold</Text>
                    <TextInput
                      value={formState.threshold}
                      onChangeText={(value) => setFormState((current) => ({ ...current, threshold: value }))}
                      placeholder="z. B. 3"
                      placeholderTextColor="#6B7280"
                      style={styles.input}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Severity</Text>
                <View style={styles.segmentRow}>
                  <SegmentButton
                    label="RED FLAG"
                    active={formState.severity === 'red_flag'}
                    onPress={() => setFormState((current) => ({ ...current, severity: 'red_flag' }))}
                  />
                  <SegmentButton
                    label="OK"
                    active={formState.severity === 'ok'}
                    onPress={() => setFormState((current) => ({ ...current, severity: 'ok' }))}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={() => void handleSave()}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={isNutrientPickerVisible} animationType="fade" transparent onRequestClose={() => setIsNutrientPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Nutrient auswählen</Text>
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
            <TouchableOpacity style={styles.cancelButton} onPress={() => setIsNutrientPickerVisible(false)}>
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isLoading ? <Text style={styles.loadingHint}>Lade Regeln…</Text> : null}
    </View>
  );
}

function describeRule(rule: FilterRule): string {
  if (rule.type === 'ingredient') {
    return 'Ingredient rule';
  }

  const operator = rule.operator ?? 'gt';
  const threshold = rule.threshold ?? 0;
  return `${rule.key} ${operator} ${threshold}`;
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
    <TouchableOpacity style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
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
    <TouchableOpacity style={[styles.segmentButton, active && styles.segmentButtonActive]} onPress={onPress}>
      <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    paddingTop: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
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
    gap: 6,
    backgroundColor: '#A7F3D0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  addButtonText: {
    color: '#0B0B0B',
    fontWeight: '800',
    fontSize: 13,
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
    gap: 12,
  },
  ruleCard: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ruleMainRow: {
    flex: 1,
    gap: 10,
  },
  ruleTextBlock: {
    gap: 4,
  },
  ruleKey: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  ruleMeta: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
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
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  deleteButton: {
    padding: 10,
    borderRadius: 999,
    backgroundColor: '#1F1F1F',
    borderWidth: 1,
    borderColor: '#2F2F2F',
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
    paddingVertical: 13,
    fontSize: 15,
  },
  selectButton: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#303030',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
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
  },
  pickerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  pickerOption: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#232323',
  },
  pickerOptionText: {
    color: '#E5E7EB',
    fontSize: 14,
  },
  cancelButton: {
    marginTop: 14,
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
  },
});
