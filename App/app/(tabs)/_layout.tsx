import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          backgroundColor: '#1E1E1E',
          borderTopColor: '#2E2E2E',
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scanner',
          tabBarLabel: 'Scanner',
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Katalog',
          tabBarLabel: 'Katalog',
          href: null,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favoriten',
          tabBarLabel: 'Favoriten',
          href: null,
        }}
      />
    </Tabs>
  );
}
