import { useEffect } from 'react';

import { Stack } from 'expo-router';

import { useFilterStore } from '../src/store/filterStore';
import { useLanguageStore } from '../src/store/languageStore';
import { BackupService } from '../src/infrastructure/db/BackupService';

export default function RootLayout() {
  const loadRules = useFilterStore((state) => state.loadRules);
  const loadLanguage = useLanguageStore((state) => state.loadLanguage);

  useEffect(() => {
    void loadRules();
    void loadLanguage();
    void BackupService.performAutoBackup();
  }, [loadRules, loadLanguage]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#121212',
        },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="result" />
      <Stack.Screen name="contribute" />
      <Stack.Screen name="edit/[ean]" />
    </Stack>
  );
}
