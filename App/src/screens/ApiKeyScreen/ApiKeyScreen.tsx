import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSettingsStore } from '../../store/settingsStore';
import type { TranslationProvider } from '../../infrastructure/translation/TranslationRouter';

export default function ApiKeyScreen() {
  const {
    provider,
    hasDeepLKey,
    hasMyMemoryKey,
    isLoading,
    loadSettings,
    setProvider,
    saveDeepLKey,
    deleteDeepLKey,
    saveMyMemoryKey,
    deleteMyMemoryKey,
  } = useSettingsStore();
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState<TranslationProvider>(provider);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setSelected(provider);
  }, [provider]);

  const handleSave = async () => {
    if (!input.trim()) return;
    if (selected === 'deepl') {
      await saveDeepLKey(input.trim());
    } else {
      await saveMyMemoryKey(input.trim());
    }
    setInput('');
    Alert.alert('Gespeichert', 'API Key wurde sicher gespeichert.');
  };

  const handleDelete = async () => {
    const label = selected === 'deepl' ? 'DeepL' : 'MyMemory';
    Alert.alert('Key entfernen', `Möchtest du den ${label} API Key wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          if (selected === 'deepl') {
            await deleteDeepLKey();
          } else {
            await deleteMyMemoryKey();
          }
          Alert.alert('Gelöscht', 'API Key wurde entfernt.');
        },
      },
    ]);
  };

  const hasKey = selected === 'deepl' ? hasDeepLKey : hasMyMemoryKey;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Übersetzung</Text>

      <View style={styles.toggle}>
        {(['mymemory', 'deepl'] as TranslationProvider[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.toggleBtn, selected === p && styles.toggleActive]}
            onPress={() => {
              setSelected(p);
              setProvider(p);
            }}
          >
            <Text style={[styles.toggleText, selected === p && styles.toggleTextActive]}>
              {p === 'deepl' ? 'DeepL' : 'MyMemory'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selected === 'mymemory' ? (
        <Text style={styles.description}>
          <Text style={styles.descriptionBold}>MyMemory</Text> ist ohne Key nutzbar (5.000
          Wörter/Tag).{'\n\n'}
          <Text style={styles.descriptionBold}>Key bekommen:</Text>
          {'\n'}Registriere dich auf <Text style={styles.link}>mymemory.translated.net</Text>
          {'\n\n'}
          Mit Key: 10.000 Wörter/Tag (keine Kreditkarte nötig).{'\n\n'}
          Der Key wird sicher auf deinem Gerät gespeichert.
        </Text>
      ) : (
        <Text style={styles.description}>
          <Text style={styles.descriptionBold}>Key bekommen:</Text>
          {'\n'}1. Registriere dich auf <Text style={styles.link}>deepl.com/pro-api</Text>
          {'\n'}2. Wähle den kostenlosen "DeepL API Free"-Plan{'\n'}3. Kopiere deinen Authentication
          Key{'\n\n'}
          Der Key hat das Format: eine Zeichenfolge aus Buchstaben und Zahlen, die mit
          <Text style={styles.descriptionBold}> :fx</Text> endet.{'\n\n'}
          Kreditkarte für Registrierung nötig.{'\n\n'}
          Der Key wird sicher auf deinem Gerät gespeichert.
        </Text>
      )}

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Status</Text>
        {hasKey ? (
          <Text style={styles.statusActive}>Key konfiguriert</Text>
        ) : selected === 'mymemory' ? (
          <Text style={styles.statusInfo}>Anonym (5.000 Wörter/Tag)</Text>
        ) : (
          <Text style={styles.statusInactive}>Kein Key hinterlegt</Text>
        )}
      </View>

      <TextInput
        style={styles.input}
        placeholder={`${selected === 'deepl' ? 'DeepL' : 'MyMemory'} API Key einfügen`}
        placeholderTextColor="#9E9E9E"
        value={input}
        onChangeText={setInput}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
      />

      <TouchableOpacity
        style={[styles.btn, styles.btnSave]}
        onPress={handleSave}
        disabled={isLoading || !input.trim()}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.btnText}>Key speichern</Text>
        )}
      </TouchableOpacity>

      {hasKey && (
        <TouchableOpacity
          style={[styles.btn, styles.btnDelete]}
          onPress={handleDelete}
          disabled={isLoading}
        >
          <Text style={styles.btnText}>Key entfernen</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  toggle: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  toggleActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  toggleText: {
    color: '#9E9E9E',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  description: {
    fontSize: 14,
    color: '#9E9E9E',
    lineHeight: 20,
    marginBottom: 24,
  },
  descriptionBold: { color: '#CFCFCF', fontWeight: '600' },
  link: { color: '#4CAF50' },
  statusCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  statusLabel: {
    fontSize: 12,
    color: '#9E9E9E',
    marginBottom: 4,
  },
  statusActive: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  statusInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFA726',
  },
  statusInactive: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
  },
  input: {
    backgroundColor: '#1E1E1E',
    color: '#fff',
    borderRadius: 8,
    padding: 14,
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  btn: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnSave: {
    backgroundColor: '#4CAF50',
  },
  btnDelete: {
    backgroundColor: '#F44336',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
