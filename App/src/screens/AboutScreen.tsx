import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../i18n/useTranslation';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const iconImage = require('../../assets/icon.png');

const APP_VERSION = '1.0.0';

export default function AboutScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Image source={iconImage} style={styles.icon} />

      <Text style={styles.appName}>FoodCheck</Text>
      <Text style={styles.version}>
        {t('about.version')} {APP_VERSION}
      </Text>

      <Text style={styles.description}>{t('about.description')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('about.dataSource')}</Text>
        <Text style={styles.sectionText}>{t('about.dataSourceText')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('about.technology')}</Text>
        <Text style={styles.sectionText}>{t('about.technologyText')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('about.dataPrivacy')}</Text>
        <Text style={styles.sectionText}>{t('about.dataPrivacyText')}</Text>
      </View>

      <Text style={styles.footer}>{t('about.footer')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  content: {
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    marginBottom: 16,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  version: {
    color: '#757575',
    fontSize: 14,
    marginBottom: 24,
  },
  description: {
    color: '#BDBDBD',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  section: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionText: {
    color: '#9E9E9E',
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    color: '#555555',
    fontSize: 12,
    marginTop: 24,
    textAlign: 'center',
  },
});
