import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OpenFoodFactsWriteClient } from '../infrastructure/api/OpenFoodFactsWriteClient';
import { useTranslation } from '../i18n/useTranslation';

interface OffAccountSetupProps {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function OffAccountSetup({ visible, onSuccess, onCancel }: OffAccountSetupProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t('off.required'));
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      const client = new OpenFoodFactsWriteClient();
      await client.saveCredentials(username.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('off.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const openRegisterLink = () => {
    Linking.openURL('https://world.openfoodfacts.org/cgi/user.pl');
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{t('off.title')}</Text>
          <Text style={styles.description}>{t('off.description')}</Text>

          <TouchableOpacity onPress={openRegisterLink} style={styles.linkButton}>
            <Text style={styles.linkText}>{t('off.register')}</Text>
          </TouchableOpacity>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('off.username')}</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder={t('off.usernamePlaceholder')}
              placeholderTextColor="#757575"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>{t('off.password')}</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder={t('off.passwordPlaceholder')}
                placeholderTextColor="#757575"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#757575" />
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isSaving}
            >
              <Text style={styles.cancelButtonText}>{t('edit.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.saveButton,
                (!username.trim() || !password.trim()) && styles.disabledButton,
              ]}
              onPress={handleSave}
              disabled={isSaving || !username.trim() || !password.trim()}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>{t('off.save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  description: { color: '#BDBDBD', fontSize: 14, marginBottom: 16, lineHeight: 20 },
  linkButton: { marginBottom: 24 },
  linkText: { color: '#2196F3', fontSize: 14, fontWeight: '600' },
  inputContainer: { marginBottom: 24 },
  label: { color: '#BDBDBD', fontSize: 14, marginBottom: 8 },
  input: {
    backgroundColor: '#121212',
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    color: '#FFF',
    padding: 12,
    fontSize: 16,
  },
  eyeButton: {
    padding: 12,
  },
  errorText: { color: '#F44336', marginBottom: 16, fontSize: 14 },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: { backgroundColor: 'transparent' },
  cancelButtonText: { color: '#BDBDBD', fontSize: 16, fontWeight: '600' },
  saveButton: { backgroundColor: '#4CAF50' },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  disabledButton: { opacity: 0.5 },
});
