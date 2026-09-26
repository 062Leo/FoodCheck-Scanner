import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OpenFoodFactsWriteClient } from '../infrastructure/api/OpenFoodFactsWriteClient';
import { WRITE_HOST } from '../infrastructure/api/config';
import { BackupError, BackupService } from '../infrastructure/db/BackupService';
import { OffAccountSetup } from '../components/OffAccountSetup';
import { useLanguageStore } from '../store/languageStore';
import { useFilterStore } from '../store/filterStore';
import { reloadStores } from '../store/reloadStores';
import { useTranslation, type TranslateFn } from '../i18n/useTranslation';
import { LANGUAGES, type SupportedLanguage } from '../i18n/translations';
import { Button, Chip, ListRow, PageTitle, SectionTitle } from '../ui/components';
import { colors, radius, spacing, typography } from '../ui/theme';

const writeClient = new OpenFoodFactsWriteClient();

function backupErrorText(error: unknown, t: TranslateFn): string {
  if (!(error instanceof BackupError)) return t('backup.error.generic');
  switch (error.code) {
    case 'no-directory':
      return t('settings.backupNoPathHint');
    case 'not-a-backup':
      return t('backup.error.notABackup');
    case 'restore-failed':
      return t('backup.error.restoreFailed');
    case 'unsupported-platform':
      return t('settings.backupIosHint');
    default:
      return t('backup.error.generic');
  }
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <SectionTitle>{title}</SectionTitle>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const ruleCount = useFilterStore((s) => s.rules.length);
  const [offUsername, setOffUsername] = useState<string | null>(null);
  const [showOffSetup, setShowOffSetup] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [autoBackup, setAutoBackup] = useState(false);
  const [backupDirLabel, setBackupDirLabel] = useState('');
  const [busy, setBusy] = useState<'backup' | 'restore' | 'folder' | null>(null);

  const loadAccount = useCallback(() => {
    writeClient
      .loadCredentials()
      .then((credentials) => setOffUsername(credentials?.username ?? null))
      .catch(() => setOffUsername(null));
  }, []);

  const loadBackupState = useCallback(async () => {
    try {
      const [last, auto, uri] = await Promise.all([
        BackupService.getLastBackupTime(),
        BackupService.isAutoBackupEnabled(),
        BackupService.getBackupUri(),
      ]);
      setLastBackupTime(last);
      setAutoBackup(auto);
      setBackupDirLabel(uri ? BackupService.directoryLabel(uri) : '');
    } catch (error) {
      console.error('Failed to load backup settings:', error);
    }
  }, []);

  useEffect(() => {
    loadAccount();
    void loadBackupState();
  }, [loadAccount, loadBackupState]);

  const hasBackupFolder = backupDirLabel.length > 0;
  const lastBackupText = lastBackupTime
    ? t('settings.backupLast', {
        date: new Date(lastBackupTime).toLocaleString(language === 'de' ? 'de-DE' : 'en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      })
    : t('settings.backupNever');

  const logout = () => {
    Alert.alert(t('settings.logoutConfirm'), t('settings.logoutConfirmMsg'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: () =>
          void writeClient
            .deleteCredentials()
            .then(() => setOffUsername(null))
            .catch(() => Alert.alert(t('settings.offAccount'), t('backup.error.generic'))),
      },
    ]);
  };

  const changeLanguage = (lang: SupportedLanguage) => {
    void setLanguage(lang).catch(() => {});
  };

  const pickFolder = async () => {
    setBusy('folder');
    try {
      setBackupDirLabel(await BackupService.pickBackupDirectory());
    } catch (error) {
      if (!(error instanceof BackupError && error.code === 'permission-denied')) {
        Alert.alert(t('settings.backup'), backupErrorText(error, t));
      }
    } finally {
      setBusy(null);
    }
  };

  const createBackup = async () => {
    setBusy('backup');
    try {
      await BackupService.createBackup();
      await loadBackupState();
      Alert.alert(t('settings.backup'), t('settings.backupDone'));
    } catch (error) {
      Alert.alert(t('settings.backup'), backupErrorText(error, t));
    } finally {
      setBusy(null);
    }
  };

  const restore = () => {
    Alert.alert(t('settings.restoreConfirm'), t('settings.restoreConfirmMsg'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.restoreBtn'),
        style: 'destructive',
        onPress: async () => {
          setBusy('restore');
          try {
            const file = await BackupService.pickRestoreFile();
            await BackupService.restoreFromUri(file.uri);
            Alert.alert(t('settings.restore'), t('settings.restoreSuccess'));
          } catch (error) {
            if (!(error instanceof BackupError && error.code === 'cancelled')) {
              Alert.alert(t('settings.restore'), backupErrorText(error, t));
            }
          } finally {
            await reloadStores().catch(() => {});
            await loadBackupState();
            setBusy(null);
          }
        },
      },
    ]);
  };

  const toggleAutoBackup = async (enabled: boolean) => {
    setAutoBackup(enabled);
    try {
      await BackupService.setAutoBackupEnabled(enabled);
    } catch {
      setAutoBackup(!enabled);
    }
  };

  return (
    <View style={styles.container}>
      <PageTitle title={t('settings.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Group title={t('settings.group.rating')}>
          <ListRow
            icon="options-outline"
            title={t('settings.filter')}
            description={t('settings.filterCount', { count: ruleCount })}
            onPress={() => router.push('/settings/filters')}
          />
        </Group>

        <Group title={t('settings.language')}>
          <View style={styles.chips}>
            {LANGUAGES.map((lang) => (
              <Chip
                key={lang.code}
                label={lang.label}
                selected={language === lang.code}
                onPress={() => changeLanguage(lang.code)}
              />
            ))}
          </View>
          <View style={styles.divider} />
          <ListRow
            icon="language-outline"
            title={t('settings.translation')}
            description={t('settings.translationHint')}
            onPress={() => router.push('/settings/api-key')}
          />
        </Group>

        <Group title={t('settings.offAccount')}>
          <ListRow
            icon="person-circle-outline"
            title={
              offUsername
                ? t('settings.loggedInAsName', { name: offUsername })
                : t('settings.login')
            }
            description={
              offUsername ? t('off.targetHint', { host: WRITE_HOST }) : t('settings.loginPrompt')
            }
            onPress={offUsername ? undefined : () => setShowOffSetup(true)}
            end={
              offUsername ? (
                <Button title={t('settings.logout')} variant="ghost" onPress={logout} />
              ) : undefined
            }
          />
        </Group>

        <Group title={t('settings.backup')}>
          <ListRow
            icon="folder-outline"
            title={t('settings.backupPath')}
            description={
              Platform.OS !== 'android'
                ? t('settings.backupIosHint')
                : hasBackupFolder
                  ? backupDirLabel
                  : t('settings.backupPathNone')
            }
            onPress={Platform.OS === 'android' ? () => void pickFolder() : undefined}
          />
          <View style={styles.divider} />
          <View style={styles.backupActions}>
            <Text style={styles.muted}>{lastBackupText}</Text>
            <Button
              title={t('settings.backupCreate')}
              icon="save-outline"
              onPress={() => void createBackup()}
              loading={busy === 'backup'}
              disabled={!hasBackupFolder || busy !== null}
            />
          </View>
          <View style={styles.divider} />
          <ListRow
            icon="time-outline"
            title={t('settings.backupAuto')}
            description={t('settings.backupAutoHint')}
            end={
              <Switch
                value={autoBackup}
                onValueChange={(value) => void toggleAutoBackup(value)}
                disabled={!hasBackupFolder}
                trackColor={{ false: colors.borderStrong, true: colors.accentSubtle }}
                thumbColor={autoBackup ? colors.accent : colors.textMuted}
                accessibilityLabel={t('settings.backupAuto')}
              />
            }
          />
          <View style={styles.divider} />
          <View style={styles.backupActions}>
            <Text style={styles.muted}>{t('settings.restoreHint')}</Text>
            <Button
              title={t('settings.restoreBtn')}
              icon="refresh-outline"
              variant="danger"
              onPress={restore}
              loading={busy === 'restore'}
              disabled={busy !== null}
            />
          </View>
        </Group>

        <Group title={t('settings.group.help')}>
          <ListRow
            icon="help-circle-outline"
            title={t('settings.howToUse')}
            description={t('settings.howToUseHint')}
            onPress={() => router.push('/settings/about')}
          />
        </Group>
      </ScrollView>

      <OffAccountSetup
        visible={showOffSetup}
        onSuccess={() => {
          setShowOffSetup(false);
          loadAccount();
        }}
        onCancel={() => setShowOffSetup(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  group: { gap: spacing.xs },
  groupBody: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  chips: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.lg,
  },
  backupActions: { padding: spacing.lg, gap: spacing.md },
  muted: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
});
