import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  OpenFoodFactsWriteClient,
  UploadError,
} from '../infrastructure/api/OpenFoodFactsWriteClient';
import { WRITE_BASE_URL, WRITE_HOST } from '../infrastructure/api/config';
import { useTranslation } from '../i18n/useTranslation';
import { Button, IconButton } from '../ui/components';
import { colors, radius, spacing, typography } from '../ui/theme';

interface OffAccountSetupProps {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

const client = new OpenFoodFactsWriteClient();

export function OffAccountSetup({ visible, onSuccess, onCancel }: OffAccountSetupProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const close = (success: boolean) => {
    setPassword('');
    setError('');
    setShowPassword(false);
    if (success) onSuccess();
    else onCancel();
  };

  const handleSave = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t('off.required'));
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await client.saveCredentials(username.trim(), password);
      close(true);
    } catch (err) {
      setError(
        err instanceof UploadError && err.code === 'invalid-credentials'
          ? t('off.invalidCredentials')
          : err instanceof UploadError && err.code === 'network'
            ? t('off.checkFailed')
            : t('off.saveError')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => close(false)}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.titleRow}>
            <Text style={styles.title} accessibilityRole="header">
              {t('off.title')}
            </Text>
            <IconButton icon="close" label={t('edit.cancel')} onPress={() => close(false)} />
          </View>
          <Text style={styles.description}>{t('off.description')}</Text>
          <Text style={styles.hint}>{t('off.targetHint', { host: WRITE_HOST })}</Text>

          <Text style={styles.label}>{t('off.username')}</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder={t('off.usernamePlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            accessibilityLabel={t('off.username')}
          />

          <Text style={styles.label}>{t('off.password')}</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.flex]}
              value={password}
              onChangeText={setPassword}
              placeholder={t('off.passwordPlaceholder')}
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              accessibilityLabel={t('off.password')}
              onSubmitEditing={() => void handleSave()}
            />
            <IconButton
              icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              label={showPassword ? t('a11y.hidePassword') : t('a11y.showPassword')}
              onPress={() => setShowPassword((value) => !value)}
            />
          </View>

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <Button
            title={t('off.save')}
            onPress={() => void handleSave()}
            loading={isSaving}
            style={styles.save}
          />
          <Button
            title={t('off.register')}
            variant="ghost"
            icon="open-outline"
            onPress={() => void Linking.openURL(`${WRITE_BASE_URL}/cgi/user.pl`)}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.title, color: colors.text, flexShrink: 1 },
  description: { ...typography.body, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textMuted },
  label: { ...typography.label, color: colors.textSecondary, marginTop: spacing.sm },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  error: { ...typography.body, color: colors.danger },
  save: { marginTop: spacing.md },
});
