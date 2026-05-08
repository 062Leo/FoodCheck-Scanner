import { Stack } from 'expo-router';

export default function RootLayout() {
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
