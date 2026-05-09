import { useEffect } from 'react';

import { Stack } from 'expo-router';

import { useFilterStore } from '../src/store/filterStore';

export default function RootLayout() {
  const loadRules = useFilterStore((state) => state.loadRules);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

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
    </Stack>
  );
}
