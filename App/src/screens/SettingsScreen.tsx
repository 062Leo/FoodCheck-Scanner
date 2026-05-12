import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OpenFoodFactsWriteClient } from '../infrastructure/api/OpenFoodFactsWriteClient';
import { OffAccountSetup } from '../components/OffAccountSetup';
import { useLanguageStore } from '../store/languageStore';
import { useTranslation } from '../i18n/useTranslation';
import { LANGUAGES } from '../i18n/translations';
import type { SupportedLanguage } from '../i18n/translations';

const writeClient = new OpenFoodFactsWriteClient();

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const [offUsername, setOffUsername] = useState<string | null>(null);
  const [showOffSetup, setShowOffSetup] = useState(false);

  useEffect(() => {
    writeClient.loadCredentials().then((creds) => {
      if (creds) setOffUsername(creds.username);
    });
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

  return (
    <View style={styles.container}>
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

      <OffAccountSetup
        visible={showOffSetup}
        onSuccess={handleOffSetupSuccess}
        onCancel={() => setShowOffSetup(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
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
});
