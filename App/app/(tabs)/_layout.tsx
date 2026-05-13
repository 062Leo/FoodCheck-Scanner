import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguageStore } from '../../src/store/languageStore';
import { getTranslations, type TranslationKey } from '../../src/i18n/translations';

export default function TabLayout() {
  const language = useLanguageStore((s) => s.language);
  const t = (key: TranslationKey) => getTranslations(language)[key] || key;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          backgroundColor: '#1E1E1E',
          borderTopColor: '#2E2E2E',
          paddingBottom: 14,
          paddingTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.scanner'),
          tabBarLabel: t('tab.scanner'),
          tabBarIcon: ({ color }) => <Ionicons name="camera" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: t('tab.catalog'),
          tabBarLabel: t('tab.catalog'),
          tabBarIcon: ({ color }) => <Ionicons name="list" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t('tab.favorites'),
          tabBarLabel: t('tab.favorites'),
          tabBarIcon: ({ color }) => <Ionicons name="star" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tab.settings'),
          tabBarLabel: t('tab.settings'),
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
