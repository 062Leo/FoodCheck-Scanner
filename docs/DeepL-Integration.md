# DeepL Integration — TrueFood-Scanner

## Was wir hinzufügen

Die App soll in der Lage sein, Text über die DeepL API ins Englische zu übersetzen.  
Damit das funktioniert, braucht jeder Nutzer einen eigenen DeepL Free API Key, den er selbst in den App-Einstellungen eintragen kann. Der Key wird sicher auf dem Gerät gespeichert (`expo-secure-store`) — niemals hardcoded.

Dafür fügen wir hinzu:
- einen **TranslationService** (Adapter zur DeepL API)
- einen **settingsStore** (Zustand für den Key-Status)
- einen **SettingsScreen** (UI zum Eintragen/Löschen des Keys)

---

## Neue Dateien

```
src/
├── infrastructure/
│   └── translation/
│       └── TranslationService.ts
├── screens/
│   └── SettingsScreen/
│       └── SettingsScreen.tsx
└── store/
    └── settingsStore.ts
```

---

## `TranslationService.ts`
> Vorschlag — kann nach Bedarf angepasst werden.

```ts
import * as SecureStore from 'expo-secure-store';

const SECURE_KEY = 'deepl_api_key';
const DEEPL_URL  = 'https://api-free.deepl.com/v2/translate';

export class TranslationService {

  static async saveApiKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(SECURE_KEY, key);
  }

  static async getApiKey(): Promise<string | null> {
    return SecureStore.getItemAsync(SECURE_KEY);
  }

  static async deleteApiKey(): Promise<void> {
    await SecureStore.deleteItemAsync(SECURE_KEY);
  }

  static async toEnglish(text: string): Promise<string> {
    const apiKey = await TranslationService.getApiKey();
    if (!apiKey || !text.trim()) return text;

    try {
      const response = await fetch(DEEPL_URL, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: [text],
          target_lang: 'EN',
        }),
      });

      if (!response.ok) return text;

      const data = await response.json();
      return data.translations?.[0]?.text ?? text;
    } catch {
      return text;
    }
  }
}
```

---

## `settingsStore.ts`
> Vorschlag — kann nach Bedarf angepasst werden.

```ts
import { create } from 'zustand';
import { TranslationService } from '../infrastructure/translation/TranslationService';

interface SettingsState {
  hasDeepLKey: boolean;
  loadKeyStatus: () => Promise<void>;
  saveDeepLKey: (key: string) => Promise<void>;
  deleteDeepLKey: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  hasDeepLKey: false,

  loadKeyStatus: async () => {
    const key = await TranslationService.getApiKey();
    set({ hasDeepLKey: !!key });
  },

  saveDeepLKey: async (key: string) => {
    await TranslationService.saveApiKey(key);
    set({ hasDeepLKey: true });
  },

  deleteDeepLKey: async () => {
    await TranslationService.deleteApiKey();
    set({ hasDeepLKey: false });
  },
}));
```

---

## `SettingsScreen.tsx`
> Vorschlag — kann nach Bedarf angepasst werden.

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSettingsStore } from '../../store/settingsStore';

export default function SettingsScreen() {
  const { hasDeepLKey, loadKeyStatus, saveDeepLKey, deleteDeepLKey } = useSettingsStore();
  const [input, setInput] = useState('');

  useEffect(() => { loadKeyStatus(); }, []);

  const handleSave = async () => {
    if (!input.trim()) return;
    await saveDeepLKey(input.trim());
    setInput('');
    Alert.alert('Saved', 'DeepL API key stored securely.');
  };

  const handleDelete = async () => {
    await deleteDeepLKey();
    Alert.alert('Removed', 'DeepL API key deleted.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Translation</Text>
      <Text style={styles.label}>
        {hasDeepLKey ? '✅ Key configured' : '⚠️ No key — translation disabled'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Paste your DeepL Free API key"
        placeholderTextColor="#9E9E9E"
        value={input}
        onChangeText={setInput}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity style={styles.btn} onPress={handleSave}>
        <Text style={styles.btnText}>Save Key</Text>
      </TouchableOpacity>

      {hasDeepLKey && (
        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleDelete}>
          <Text style={styles.btnText}>Remove Key</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24 },
  title:     { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  label:     { color: '#9E9E9E', marginBottom: 24 },
  input:     { backgroundColor: '#1E1E1E', color: '#FFFFFF', borderRadius: 8,
               padding: 12, marginBottom: 12 },
  btn:       { backgroundColor: '#00BFA5', borderRadius: 8, padding: 14,
               alignItems: 'center', marginBottom: 8 },
  btnDanger: { backgroundColor: '#F44336' },
  btnText:   { color: '#FFFFFF', fontWeight: '600' },
});
```

---

## Expo Router — Settings Tab
> Vorschlag — kann nach Bedarf angepasst werden.

```
app/(tabs)/settings.tsx
```

```ts
export { default } from '../../src/screens/SettingsScreen/SettingsScreen';
```

Tab in `app/(tabs)/_layout.tsx` eintragen.

---

## Referenz

| | |
|---|---|
| DeepL Free Endpoint | `https://api-free.deepl.com/v2/translate` |
| DeepL Pro Endpoint | `https://api.deepl.com/v2/translate` |
| Auth Header | `Authorization: DeepL-Auth-Key <key>` |
| Free Limit | 500.000 Zeichen/Monat |
| Key Storage | `expo-secure-store` |

---

## Navigation — Filter Tab wird zu Settings Tab

### Was sich ändert

Der bestehende **Filter**-Tab in der unteren Tab-Leiste wird in **Settings** umbenannt.  
Innerhalb des neuen Settings-Screens gibt es zwei Einstiegspunkte:
- einen Link/Button → führt zum bisherigen `FilterScreen` (bleibt unverändert)
- einen Link/Button → führt zum neuen `SettingsScreen` (DeepL API Key)

Der `FilterScreen` selbst wird **nicht angefasst** — er bleibt wie er ist, wird nur nicht mehr direkt als Tab angezeigt, sondern über Settings erreichbar.

### Änderungen in Expo Router
> Vorschlag — kann nach Bedarf angepasst werden.

**Vorher:**
```
app/(tabs)/filters.tsx   ← direkt als Tab
```

**Nachher:**
```
app/(tabs)/settings.tsx          ← neuer Tab-Eintrag (ersetzt filters)
app/settings/filters.tsx         ← FilterScreen als Stack-Route unter Settings
app/settings/api-key.tsx         ← SettingsScreen (DeepL) als Stack-Route unter Settings
```

### Neuer `SettingsScreen` (Übersichtsseite)
> Vorschlag — kann nach Bedarf angepasst werden.

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function SettingsOverviewScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.item} onPress={() => router.push('/settings/filters')}>
        <Text style={styles.itemText}>Filter</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push('/settings/api-key')}>
        <Text style={styles.itemText}>Translation (DeepL API Key)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24 },
  item:      { backgroundColor: '#1E1E1E', borderRadius: 8, padding: 16, marginBottom: 12 },
  itemText:  { color: '#FFFFFF', fontSize: 16 },
});
```

### `app/(tabs)/settings.tsx`
```ts
export { default } from '../../src/screens/SettingsOverviewScreen/SettingsOverviewScreen';
```

### `app/settings/filters.tsx`
```ts
export { default } from '../../../src/screens/FilterScreen/FilterScreen';
```

### `app/settings/api-key.tsx`
```ts
export { default } from '../../../src/screens/SettingsScreen/SettingsScreen';
```

### `app/(tabs)/_layout.tsx`
Den bisherigen `filters`-Tab-Eintrag durch `settings` ersetzen. Icon nach Wahl.
