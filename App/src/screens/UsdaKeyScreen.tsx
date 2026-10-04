import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../i18n/useTranslation';
import { useSettingsStore } from '../store/settingsStore';
import { USDA_KEY_SIGNUP_URL } from '../infrastructure/api/UsdaClient';
import { Button, Card, ScreenHeader } from '../ui/components';
import { FormField } from '../ui/FormField';
import { colors, spacing, typography } from '../ui/theme';

/** The user's own api.data.gov key for the USDA FoodData Central fallback. */
export default function UsdaKeyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const hasKey = useSettingsStore((s) => s.hasUsdaKey);
  const isLoading = useSettingsStore((s) => s.isLoading);
  const store = useSettingsStore.getState;
  const [input, setInput] = useState('');

  useEffect(() => {
    void useSettingsStore.getState().loadSettings();
  }, []);

  const save = async () => {
    const key = input.trim();
    if (!key) return;
    const ok = await store().saveUsdaKey(key);
    if (ok) setInput('');
    Alert.alert(ok ? t('api.saved') : t('api.saveFailed'), ok ? t('api.savedMsg') : undefined);
  };

  const remove = () => {
    Alert.alert(t('api.removeTitle'), t('api.removeMsg', { label: 'USDA' }), [
      { text: t('edit.cancel'), style: 'cancel' },
      {
        text: t('catalog.delete'),
        style: 'destructive',
        onPress: async () => {
          const ok = await store().deleteUsdaKey();
          Alert.alert(
            ok ? t('api.removed') : t('api.saveFailed'),
            ok ? t('api.removedMsg') : undefined
          );
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('usda.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card style={styles.card}>
            <Text style={styles.body}>{t('usda.help')}</Text>
            <Text style={styles.status}>
              {t('api.status')}:{' '}
              <Text style={hasKey ? styles.ok : styles.muted}>
                {hasKey ? t('api.keyConfigured') : t('usda.noKey')}
              </Text>
            </Text>
          </Card>
          <Button
            title={t('usda.signup')}
            icon="open-outline"
            variant="ghost"
            onPress={() => void Linking.openURL(USDA_KEY_SIGNUP_URL)}
          />

          <FormField
            label={t('usda.placeholder')}
            value={input}
            onChangeText={setInput}
            hint={t('api.storedSecurely')}
            secret
          />
          <Button
            title={t('api.saveKey')}
            icon="key-outline"
            onPress={() => void save()}
            loading={isLoading}
            disabled={!input.trim()}
          />
          {hasKey && (
            <Button
              title={t('api.removeKey')}
              variant="danger"
              onPress={remove}
              disabled={isLoading}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  body: { ...typography.body, color: colors.textSecondary },
  status: { ...typography.bodyStrong, color: colors.text },
  ok: { color: colors.accent },
  muted: { color: colors.textMuted },
});
