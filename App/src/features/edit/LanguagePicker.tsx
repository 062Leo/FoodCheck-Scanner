import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TranslateFn } from '../../i18n/useTranslation';
import { languageLabel } from '../../i18n/languageLabel';
import { colors, radius, spacing, typography, TOUCH_TARGET } from '../../ui/theme';

export const ALL_LANGUAGES = '*';

/** Bottom sheet listing languages; optionally with an "all languages" entry. */
export function LanguagePicker({
  visible,
  title,
  languages,
  includeAll,
  t,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  languages: readonly string[];
  includeAll?: boolean;
  t: TranslateFn;
  onSelect: (language: string) => void;
  onClose: () => void;
}) {
  const options = includeAll && languages.length > 1 ? [...languages, ALL_LANGUAGES] : languages;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('edit.cancel')}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <ScrollView>
            {options.map((code) => (
              <Pressable
                key={code}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                onPress={() => onSelect(code)}
                accessibilityRole="button"
              >
                <Text style={styles.optionText}>
                  {code === ALL_LANGUAGES ? t('edit.langPicker.all') : languageLabel(code, t)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  title: { ...typography.subtitle, color: colors.text, marginBottom: spacing.sm },
  option: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  optionText: { ...typography.body, color: colors.text },
});
