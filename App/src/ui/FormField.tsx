import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { colors, radius, spacing, typography } from './theme';

/** Labelled text input with an optional hint and inline error. */
export function FormField({
  label,
  value,
  onChangeText,
  error,
  hint,
  placeholder,
  keyboardType,
  multiline,
  required,
  secret,
  code,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  required?: boolean;
  /** Keys and passwords: hidden, no capitalisation, correction or suggestions. */
  secret?: boolean;
  /** Codes such as an egg code: upper case, no correction or suggestions. */
  code?: boolean;
  testID?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secret}
        autoCapitalize={secret ? 'none' : code ? 'characters' : undefined}
        autoCorrect={secret || code ? false : undefined}
        autoComplete={secret || code ? 'off' : undefined}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multiline, error ? styles.inputError : null]}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        testID={testID}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { ...typography.label, color: colors.textSecondary },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  multiline: { minHeight: 110 },
  inputError: { borderColor: colors.danger },
  error: { ...typography.caption, color: colors.danger },
  hint: { ...typography.caption, color: colors.textMuted },
});
