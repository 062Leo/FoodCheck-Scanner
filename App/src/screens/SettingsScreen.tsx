import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { OpenFoodFactsWriteClient } from '../infrastructure/api/OpenFoodFactsWriteClient';
import { OffAccountSetup } from '../components/OffAccountSetup/OffAccountSetup';

const writeClient = new OpenFoodFactsWriteClient();

export default function SettingsScreen() {
  const router = useRouter();
  const [offUsername, setOffUsername] = useState<string | null>(null);
  const [showOffSetup, setShowOffSetup] = useState(false);

  useEffect(() => {
    writeClient.loadCredentials().then((creds) => {
      if (creds) setOffUsername(creds.username);
    });
  }, []);

  const handleOffSetupSuccess = () => {
    setShowOffSetup(false);
    writeClient.loadCredentials().then((creds) => {
      if (creds) setOffUsername(creds.username);
    });
  };

  const handleLogout = () => {
    Alert.alert('Open Food Facts', 'Bist du sicher, dass du dich abmelden möchtest?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Abmelden',
        style: 'destructive',
        onPress: async () => {
          await writeClient.deleteCredentials();
          setOffUsername(null);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Einstellungen</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Open Food Facts Konto</Text>
        {offUsername ? (
          <View style={styles.accountInfo}>
            <View style={styles.accountRow}>
              <View style={styles.statusDot} />
              <Text style={styles.accountText}>Angemeldet als: {offUsername}</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>Abmelden</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.accountInfo}>
            <Text style={styles.accountHint}>
              Melde dich an, um Produktdaten an Open Food Facts zu senden.
            </Text>
            <TouchableOpacity style={styles.loginBtn} onPress={() => setShowOffSetup(true)}>
              <Text style={styles.loginBtnText}>Anmelden</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.item} onPress={() => router.push('/settings/filters')}>
        <Text style={styles.itemText}>Filter</Text>
        <Text style={styles.itemHint}>Zutaten- und Nährwertregeln verwalten</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push('/settings/api-key')}>
        <Text style={styles.itemText}>Übersetzung (DeepL API Key)</Text>
        <Text style={styles.itemHint}>Eigenen DeepL Free API Key hinterlegen</Text>
      </TouchableOpacity>

      <OffAccountSetup
        visible={showOffSetup}
        onSuccess={handleOffSetupSuccess}
        onCancel={() => setShowOffSetup(false)}
      />
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
  section: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  accountInfo: {
    gap: 12,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  accountText: {
    color: '#BDBDBD',
    fontSize: 14,
  },
  accountHint: {
    color: '#9E9E9E',
    fontSize: 13,
    lineHeight: 18,
  },
  loginBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F44336',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  logoutBtnText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
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
