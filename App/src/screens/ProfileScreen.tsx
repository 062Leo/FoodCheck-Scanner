import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OpenFoodFactsWriteClient } from '../infrastructure/api/OpenFoodFactsWriteClient';
import { UserProfileClient, UserProfileFetchError } from '../infrastructure/api/UserProfileClient';
import type { UserProfile } from '../types/UserProfile';

const writeClient = new OpenFoodFactsWriteClient();
const profileClient = new UserProfileClient();

export default function ProfileScreen() {
  const [username, setUsername] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const creds = await writeClient.loadCredentials();
        if (!creds) {
          setIsLoading(false);
          return;
        }
        setUsername(creds.username);

        const data = await profileClient.fetchProfile(creds.username);
        setProfile(data);
      } catch (err) {
        if (err instanceof UserProfileFetchError) {
          setError(err.message);
        } else {
          setError('Failed to load profile');
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      </View>
    );
  }

  if (!username) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Profil</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="person-circle-outline" size={64} color="#666" />
          <Text style={styles.emptyTitle}>Nicht angemeldet</Text>
          <Text style={styles.emptyText}>
            Melde dich in den Einstellungen mit deinem Open Food Facts Konto an.
          </Text>
        </View>
      </View>
    );
  }

  const openProfileUrl = () => {
    if (profile?.profileUrl) {
      Linking.openURL(profile.profileUrl);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={20} color="#F44336" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color="#fff" />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.username}>{username}</Text>
              <TouchableOpacity onPress={openProfileUrl}>
                <Text style={styles.profileLink}>Open Food Facts Profil</Text>
              </TouchableOpacity>
            </View>
          </View>

          {profile?.joinDate && (
            <View style={styles.joinDateRow}>
              <Ionicons name="calendar-outline" size={16} color="#9E9E9E" />
              <Text style={styles.joinDate}>
                Mitglied seit{' '}
                {new Date(profile.joinDate).toLocaleDateString('de-DE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Beiträge</Text>

        <View style={styles.statsGrid}>
          <StatCard
            icon="cube-outline"
            label="Produkte erstellt"
            value={profile?.productsAdded ?? null}
            color="#4CAF50"
          />
          <StatCard
            icon="create-outline"
            label="Produkte bearbeitet"
            value={profile?.productsEdited ?? null}
            color="#2196F3"
          />
          <StatCard
            icon="camera-outline"
            label="Fotos hochgeladen"
            value={profile?.photosUploaded ?? null}
            color="#FF9800"
          />
          <StatCard
            icon="scan-outline"
            label="Produkte gescannt"
            value={profile?.productsScanned ?? null}
            color="#9C27B0"
          />
        </View>

        {profile &&
          profile.productsAdded === null &&
          profile.productsEdited === null &&
          profile.photosUploaded === null &&
          profile.productsScanned === null && (
            <View style={styles.noStatsCard}>
              <Ionicons name="information-circle-outline" size={20} color="#9E9E9E" />
              <Text style={styles.noStatsText}>
                Keine detaillierten Statistiken verfügbar. Besuche dein Open Food Facts Profil für
                mehr Informationen.
              </Text>
            </View>
          )}
      </ScrollView>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | null;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.statValue, { color }]}>
        {value !== null ? value.toLocaleString('de-DE') : '—'}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  header: {
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244,67,54,0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.3)',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  username: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  profileLink: {
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '500',
  },
  joinDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  joinDate: {
    fontSize: 13,
    color: '#9E9E9E',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#BDBDBD',
    marginTop: 24,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    width: '47%',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 16,
  },
  noStatsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  noStatsText: {
    color: '#9E9E9E',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
});
