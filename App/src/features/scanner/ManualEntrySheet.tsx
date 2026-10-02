import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TranslateFn } from '../../i18n/useTranslation';
import { Button } from '../../ui/components';
import { colors, radius, spacing, typography } from '../../ui/theme';

/** Fallback when the camera cannot read a code (damaged label, darkness, no permission). */
export function ManualEntrySheet({
  visible,
  t,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  t: TranslateFn;
  /** Returns false if the code is invalid. */
  onSubmit: (code: string) => boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);

  const close = () => {
    setCode('');
    setInvalid(false);
    onClose();
  };

  const submit = () => {
    if (onSubmit(code)) {
      close();
    } else {
      setInvalid(true);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.flex}
          onPress={close}
          accessibilityLabel={t('manualEntry.cancel')}
        />
        <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
          <Text style={styles.title} accessibilityRole="header">
            {t('manualEntry.title')}
          </Text>
          <TextInput
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/[^\d\s-]/g, ''));
              setInvalid(false);
            }}
            keyboardType="number-pad"
            autoFocus
            maxLength={17}
            placeholder="4006381333931"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, invalid && styles.inputInvalid]}
            accessibilityLabel={t('manualEntry.title')}
            accessibilityHint={t('manualEntry.hint')}
            onSubmitEditing={submit}
            returnKeyType="search"
            testID="manual-ean-input"
          />
          <Text style={invalid ? styles.error : styles.hint} accessibilityLiveRegion="polite">
            {invalid ? t('manualEntry.invalid') : t('manualEntry.hint')}
          </Text>
          <View style={styles.actions}>
            <Button
              title={t('manualEntry.cancel')}
              variant="secondary"
              onPress={close}
              style={styles.flex}
            />
            <Button
              title={t('manualEntry.submit')}
              icon="search"
              onPress={submit}
              disabled={code.replace(/\D/g, '').length < 8}
              style={styles.flex}
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.text },
  input: {
    ...typography.title,
    color: colors.text,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    letterSpacing: 2,
  },
  inputInvalid: { borderColor: colors.danger },
  hint: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
