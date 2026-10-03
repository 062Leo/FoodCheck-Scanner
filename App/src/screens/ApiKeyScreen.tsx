import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../i18n/useTranslation';
import { useSettingsStore } from '../store/settingsStore';
import type { TranslationProvider } from '../infrastructure/translation/TranslationRouter';
import { Button, Card, Chip, ScreenHeader, SectionTitle } from '../ui/components';
import { FormField } from '../ui/FormField';
import { colors, spacing, typography } from '../ui/theme';

const PROVIDERS: { id: TranslationProvider; label: string }[] = [
  { id: 'mymemory', label: 'MyMemory' },
  { id: 'deepl', label: 'DeepL' },
];

export default function ApiKeyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const provider = useSettingsStore((s) => s.provider);
  const hasDeepLKey = useSettingsStore((s) => s.hasDeepLKey);
  const hasMyMemoryKey = useSettingsStore((s) => s.hasMyMemoryKey);
  const isLoading = useSettingsStore((s) => s.isLoading);
  const store = useSettingsStore.getState;
  const [input, setInput] = useState('');

  useEffect(() => {
    void useSettingsStore.getState().loadSettings();
  }, []);

  const label = provider === 'deepl' ? 'DeepL' : 'MyMemory';
  const hasKey = provider === 'deepl' ? hasDeepLKey : hasMyMemoryKey;
  const status = hasKey
    ? t('api.keyConfigured')
    : provider === 'mymemory'
      ? t('api.anonymous')
      : t('api.noKeyDeepL');

  const save = async () => {
    const key = input.trim();
    if (!key) return;
    const ok =
      provider === 'deepl' ? await store().saveDeepLKey(key) : await store().saveMyMemoryKey(key);
    if (ok) setInput('');
    Alert.alert(ok ? t('api.saved') : t('api.saveFailed'), ok ? t('api.savedMsg') : undefined);
  };

  const remove = () => {
    Alert.alert(t('api.removeTitle'), t('api.removeMsg', { label }), [
      { text: t('edit.cancel'), style: 'cancel' },
      {
        text: t('catalog.delete'),
        style: 'destructive',
        onPress: async () => {
          const ok =
            provider === 'deepl'
              ? await store().deleteDeepLKey()
              : await store().deleteMyMemoryKey();
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
        title={t('api.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <SectionTitle>{t('api.provider')}</SectionTitle>
            <View style={styles.chips}>
              {PROVIDERS.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  selected={provider === option.id}
                  onPress={() => {
                    if (option.id !== provider) setInput('');
                    void store().setProvider(option.id);
                  }}
                />
              ))}
            </View>
          </View>

          <Card style={styles.card}>
            <Text style={styles.body}>
              {provider === 'mymemory' ? t('api.help.mymemory') : t('api.help.deepl')}
            </Text>
            <Text style={styles.status}>
              {t('api.status')}: <Text style={hasKey ? styles.ok : styles.muted}>{status}</Text>
            </Text>
          </Card>

          <FormField
            label={
              provider === 'deepl' ? t('api.placeholder.deepl') : t('api.placeholder.mymemory')
            }
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
  section: { gap: spacing.xs },
  chips: { flexDirection: 'row', gap: spacing.sm },
  card: { gap: spacing.md },
  body: { ...typography.body, color: colors.textSecondary },
  status: { ...typography.bodyStrong, color: colors.text },
  ok: { color: colors.accent },
  muted: { color: colors.textMuted },
});
