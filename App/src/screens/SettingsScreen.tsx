import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OpenFoodFactsWriteClient } from '../infrastructure/api/OpenFoodFactsWriteClient';
import { OffAccountSetup } from '../components/OffAccountSetup';
import { useLanguageStore } from '../store/languageStore';
import { useTranslation } from '../i18n/useTranslation';
import { LANGUAGES } from '../i18n/translations';
import type { SupportedLanguage } from '../i18n/translations';
import { BackupService } from '../infrastructure/db/BackupService';
import { Accordion } from '../components/Accordion';

const writeClient = new OpenFoodFactsWriteClient();

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const [offUsername, setOffUsername] = useState<string | null>(null);
  const [showOffSetup, setShowOffSetup] = useState(false);
  const [backupCreating, setBackupCreating] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [autoBackup, setAutoBackup] = useState(false);
  const [backupDirLabel, setBackupDirLabel] = useState('');
  const [hasCustomPath, setHasCustomPath] = useState(false);
  const [pickingDir, setPickingDir] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [howToUseExpanded, setHowToUseExpanded] = useState(false);

  useEffect(() => {
    writeClient.loadCredentials().then((creds) => {
      if (creds) setOffUsername(creds.username);
    });

    BackupService.getLastBackupTime().then(setLastBackupTime);
    BackupService.isAutoBackupEnabled().then(setAutoBackup);
    BackupService.getBackupUri().then((uri) => {
      if (uri) {
        const label = uri.startsWith('content://')
          ? uri.split('%3A').pop()?.split('/')[0] || uri
          : uri;
        setBackupDirLabel(label);
      }
    });
    BackupService.isBackupPathConfigured().then(setHasCustomPath);
  }, []);

  const handleOffSetupSuccess = () => {
    setShowOffSetup(false);
    writeClient.loadCredentials().then((creds) => {
      if (creds) setOffUsername(creds.username);
    });
  };

  const handleLogout = () => {
    Alert.alert(t('settings.logoutConfirm'), t('settings.logoutConfirmMsg'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: async () => {
          await writeClient.deleteCredentials();
          setOffUsername(null);
        },
      },
    ]);
  };

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
  };

  const handleCreateBackup = async () => {
    if (!hasCustomPath) return;
    setBackupCreating(true);
    try {
      const backupPathResult = await BackupService.createBackup();
      const time = await BackupService.getLastBackupTime();
      setLastBackupTime(time);
      Alert.alert(t('settings.backup'), t('settings.backupSuccess', { path: backupPathResult }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(t('settings.backup'), message);
    } finally {
      setBackupCreating(false);
    }
  };

  const handlePickDirectory = async () => {
    setPickingDir(true);
    try {
      const dirName = await BackupService.pickBackupDirectory();
      setBackupDirLabel(dirName);
      setHasCustomPath(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('permission denied') && !message.includes('cancel')) {
        Alert.alert(t('settings.backup'), message);
      }
    } finally {
      setPickingDir(false);
    }
  };

  const handleRestore = () => {
    Alert.alert(t('settings.restoreConfirm'), t('settings.restoreConfirmMsg'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.restoreBtn'),
        style: 'destructive',
        onPress: async () => {
          setRestoring(true);
          try {
            const file = await BackupService.pickRestoreFile();
            await BackupService.restoreFromUri(file.uri);
            Alert.alert(t('settings.restore'), t('settings.restoreSuccess'));
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (!message.includes('cancel')) {
              Alert.alert(t('settings.restore'), message);
            }
          } finally {
            setRestoring(false);
          }
        },
      },
    ]);
  };

  const handleAutoBackupToggle = async (enabled: boolean) => {
    setAutoBackup(enabled);
    await BackupService.setAutoBackupEnabled(enabled);
  };

  const formatBackupDate = (iso: string | null): string => {
    if (!iso) return t('settings.backupNever');
    const date = new Date(iso);
    return t('settings.backupLast', {
      date: date.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.offAccount')}</Text>
        {offUsername ? (
          <View style={styles.accountInfo}>
            <View style={styles.accountRow}>
              <View style={styles.statusDot} />
              <Text style={styles.accountText}>
                {t('settings.loggedInAs')} {offUsername}
              </Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>{t('settings.logout')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.accountInfo}>
            <Text style={styles.accountHint}>{t('settings.loginPrompt')}</Text>
            <TouchableOpacity style={styles.loginBtn} onPress={() => setShowOffSetup(true)}>
              <Text style={styles.loginBtnText}>{t('settings.login')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <Text style={styles.accountHint}>{t('settings.languageHint')}</Text>
        <View style={styles.languageRow}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.languageChip, language === lang.code && styles.languageChipActive]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <Ionicons
                name={language === lang.code ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={language === lang.code ? '#4CAF50' : '#757575'}
              />
              <Text
                style={[
                  styles.languageChipText,
                  language === lang.code && styles.languageChipTextActive,
                ]}
              >
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.item} onPress={() => router.push('/settings/filters')}>
        <Text style={styles.itemText}>{t('settings.filter')}</Text>
        <Text style={styles.itemHint}>{t('settings.filterHint')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push('/settings/api-key')}>
        <Text style={styles.itemText}>{t('settings.deepl')}</Text>
        <Text style={styles.itemHint}>{t('settings.deeplHint')}</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="cloud-download-outline" size={16} color="#FFFFFF" />{' '}
          {t('settings.backup')}
        </Text>
        <Text style={styles.accountHint}>{t('settings.backupHint')}</Text>

        <View style={styles.backupPathRow}>
          <View style={styles.backupPathInfo}>
            <Text style={styles.backupPathLabel}>{t('settings.backupPath')}</Text>
            <Text style={styles.backupPathValue} numberOfLines={1}>
              {hasCustomPath ? backupDirLabel : t('settings.backupPathNone')}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.pathChangeBtn, pickingDir && styles.pathChangeBtnDisabled]}
            onPress={handlePickDirectory}
            disabled={pickingDir}
          >
            <Ionicons name="folder-open-outline" size={14} color="#4CAF50" />
            <Text style={styles.pathChangeBtnText}>
              {pickingDir ? t('settings.backupPicking') : t('settings.backupPathChoose')}
            </Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === 'ios' && (
          <Text style={styles.backupIosHint}>{t('settings.backupIosHint')}</Text>
        )}

        {!hasCustomPath && (
          <Text style={styles.backupNoPathHint}>{t('settings.backupNoPathHint')}</Text>
        )}

        <View style={styles.backupRow}>
          <View style={styles.backupInfo}>
            <Ionicons
              name={lastBackupTime ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={lastBackupTime ? '#4CAF50' : '#757575'}
            />
            <Text style={styles.backupDateText}>{formatBackupDate(lastBackupTime)}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.backupBtn,
              (!hasCustomPath || backupCreating) && styles.backupBtnDisabled,
            ]}
            onPress={handleCreateBackup}
            disabled={!hasCustomPath || backupCreating}
          >
            <Ionicons
              name={backupCreating ? 'hourglass-outline' : 'save-outline'}
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.backupBtnText}>
              {backupCreating ? t('settings.backupCreating') : t('settings.backupCreate')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.restoreRow}>
          <View style={styles.backupInfo}>
            <Ionicons name="refresh-outline" size={16} color="#FF9800" />
            <Text style={styles.restoreText}>{t('settings.restoreHint')}</Text>
          </View>
          <TouchableOpacity
            style={[styles.restoreBtn, restoring && styles.backupBtnDisabled]}
            onPress={handleRestore}
            disabled={restoring}
          >
            <Ionicons
              name={restoring ? 'hourglass-outline' : 'folder-open-outline'}
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.restoreBtnText}>
              {restoring ? '...' : t('settings.restoreBtn')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.autoBackupRow}>
          <View style={styles.autoBackupInfo}>
            <Text style={styles.autoBackupLabel}>{t('settings.backupAuto')}</Text>
            <Text style={styles.autoBackupHint}>{t('settings.backupAutoHint')}</Text>
          </View>
          <Switch
            value={autoBackup}
            onValueChange={handleAutoBackupToggle}
            trackColor={{ false: '#2E2E2E', true: '#2E5A2E' }}
            thumbColor={autoBackup ? '#4CAF50' : '#757575'}
            disabled={!hasCustomPath}
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.item}
        onPress={() => setHowToUseExpanded(!howToUseExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.howToUseHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemText}>{t('settings.howToUse')}</Text>
            <Text style={styles.itemHint}>{t('settings.howToUseHint')}</Text>
          </View>
          <Ionicons
            name={howToUseExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#757575"
          />
        </View>
      </TouchableOpacity>

      {howToUseExpanded && (
        <View style={styles.howToUseContent}>
          <Accordion
            items={[
              {
                title: t('tab.scanner'),
                content: <Text style={styles.howToUseText}>{t('howToUse.scanner')}</Text>,
              },
              {
                title: t('catalog.title'),
                content: <Text style={styles.howToUseText}>{t('howToUse.catalog')}</Text>,
              },
              {
                title: t('tab.favorites'),
                content: <Text style={styles.howToUseText}>{t('howToUse.favorites')}</Text>,
              },
              {
                title: t('edit.title'),
                content: <Text style={styles.howToUseText}>{t('howToUse.edit')}</Text>,
              },
              {
                title: t('settings.backup'),
                content: <Text style={styles.howToUseText}>{t('howToUse.backup')}</Text>,
              },
            ]}
          />
        </View>
      )}

      <TouchableOpacity style={styles.item} onPress={() => router.push('/settings/about')}>
        <Text style={styles.itemText}>{t('settings.about')}</Text>
        <Text style={styles.itemHint}>{t('settings.aboutHint')}</Text>
      </TouchableOpacity>

      <OffAccountSetup
        visible={showOffSetup}
        onSuccess={handleOffSetupSuccess}
        onCancel={() => setShowOffSetup(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  scrollContent: {
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  accountInfo: {
    gap: 12,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  accountText: {
    color: '#BDBDBD',
    fontSize: 14,
  },
  accountHint: {
    color: '#9E9E9E',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  loginBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F44336',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  logoutBtnText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
  },
  languageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  languageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  languageChipActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#1a2e1a',
  },
  languageChipText: {
    color: '#9E9E9E',
    fontSize: 14,
    fontWeight: '500',
  },
  languageChipTextActive: {
    color: '#4CAF50',
  },
  item: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  itemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemHint: {
    color: '#9E9E9E',
    fontSize: 13,
  },
  backupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backupPathRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  backupPathInfo: {
    flex: 1,
    marginRight: 12,
  },
  backupPathLabel: {
    color: '#9E9E9E',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  backupPathValue: {
    color: '#BDBDBD',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  pathChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  pathChangeBtnDisabled: {
    borderColor: '#2E5A2E',
  },
  pathChangeBtnText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  backupIosHint: {
    color: '#9E9E9E',
    fontSize: 11,
    marginBottom: 14,
    fontStyle: 'italic',
  },
  backupNoPathHint: {
    color: '#F44336',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 14,
  },
  restoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingTop: 12,
  },
  restoreText: {
    color: '#BDBDBD',
    fontSize: 11,
    flex: 1,
    marginLeft: 6,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  restoreBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  backupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  backupDateText: {
    color: '#BDBDBD',
    fontSize: 13,
  },
  backupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  backupBtnDisabled: {
    backgroundColor: '#2E5A2E',
  },
  backupBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  autoBackupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingTop: 14,
  },
  autoBackupInfo: {
    flex: 1,
  },
  autoBackupLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  autoBackupHint: {
    color: '#9E9E9E',
    fontSize: 12,
    marginTop: 2,
  },
  howToUseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  howToUseContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 8,
    marginTop: -6,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  howToUseText: {
    color: '#BDBDBD',
    fontSize: 13,
    lineHeight: 20,
  },
});
