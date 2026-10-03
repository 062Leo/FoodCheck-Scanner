import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useFilterStore } from '../src/store/filterStore';
import { useLanguageStore } from '../src/store/languageStore';
import { useAllergenStore } from '../src/store/allergenStore';
import { BackupService } from '../src/infrastructure/db/BackupService';
import { colors } from '../src/ui/theme';

export default function RootLayout() {
  const loadRules = useFilterStore((state) => state.loadRules);
  const loadLanguage = useLanguageStore((state) => state.loadLanguage);
  const loadAllergenProfile = useAllergenStore((state) => state.loadProfile);

  useEffect(() => {
    void loadRules();
    void loadLanguage();
    void loadAllergenProfile();
    void BackupService.performAutoBackup();
  }, [loadRules, loadLanguage, loadAllergenProfile]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="result" />
        <Stack.Screen name="edit/[ean]" />
      </Stack>
    </>
  );
}
