import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Einstellungen</Text>

      <TouchableOpacity style={styles.item} onPress={() => router.push('/settings/filters')}>
        <Text style={styles.itemText}>Filter</Text>
        <Text style={styles.itemHint}>Zutaten- und Nährwertregeln verwalten</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push('/settings/api-key')}>
        <Text style={styles.itemText}>Übersetzung (DeepL API Key)</Text>
        <Text style={styles.itemHint}>Eigenen DeepL Free API Key hinterlegen</Text>
      </TouchableOpacity>
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
    marginBottom: 24,
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
