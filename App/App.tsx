import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <>
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
      <StatusBar style="light" />
    </>
  );
}
