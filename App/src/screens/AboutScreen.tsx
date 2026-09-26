import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTranslation } from '../i18n/useTranslation';
import type { TranslationKey } from '../i18n/translations';
import { Accordion } from '../components/Accordion';
import { Card, ScreenHeader, SectionTitle } from '../ui/components';
import { StatusBadge } from '../ui/status';
import { colors, radius, spacing, typography } from '../ui/theme';
import type { ScanStatus } from '../types/ScanResult';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const iconImage = require('../../assets/icon.png');

const RATING_RULES: { status: ScanStatus; text: TranslationKey }[] = [
  { status: 'Critical', text: 'about.rating.critical' },
  { status: 'Warning', text: 'about.rating.warning' },
  { status: 'OK', text: 'about.rating.ok' },
  { status: 'Unknown', text: 'about.rating.unknown' },
];

const HOW_TO: { title: TranslationKey; text: TranslationKey }[] = [
  { title: 'tab.scanner', text: 'howToUse.scanner' },
  { title: 'howToUse.resultTitle', text: 'howToUse.result' },
  { title: 'catalog.title', text: 'howToUse.catalog' },
  { title: 'edit.title', text: 'howToUse.edit' },
  { title: 'settings.backup', text: 'howToUse.backup' },
];

export default function AboutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '';

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('settings.about')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={iconImage} style={styles.icon} accessibilityIgnoresInvertColors />
          <Text style={styles.appName}>FoodCheck</Text>
          <Text style={styles.muted}>
            {t('about.version')} {version}
          </Text>
          <Text style={styles.body}>{t('about.description')}</Text>
        </View>

        <View style={styles.section}>
          <SectionTitle>{t('about.rating.title')}</SectionTitle>
          <Card style={styles.ratingCard}>
            {RATING_RULES.map(({ status, text }) => (
              <View key={status} style={styles.ratingRow}>
                <StatusBadge status={status} t={t} />
                <Text style={styles.body}>{t(text)}</Text>
              </View>
            ))}
            <Text style={styles.muted}>{t('about.rating.note')}</Text>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionTitle>{t('settings.howToUse')}</SectionTitle>
          <Accordion
            items={HOW_TO.map(({ title, text }) => ({
              title: t(title),
              content: <Text style={styles.body}>{t(text)}</Text>,
            }))}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>{t('about.dataPrivacy')}</SectionTitle>
          <Text style={styles.body}>{t('about.dataPrivacyText')}</Text>
        </View>

        <View style={styles.section}>
          <SectionTitle>{t('about.dataSource')}</SectionTitle>
          <Text style={styles.body}>{t('about.dataSourceText')}</Text>
        </View>

        <View style={styles.section}>
          <SectionTitle>{t('about.technology')}</SectionTitle>
          <Text style={styles.body}>{t('about.technologyText')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.sm },
  icon: { width: 88, height: 88, borderRadius: radius.lg },
  appName: { ...typography.headline, color: colors.text },
  section: { gap: spacing.xs },
  body: { ...typography.body, color: colors.textSecondary, flexShrink: 1 },
  muted: { ...typography.caption, color: colors.textMuted },
  ratingCard: { gap: spacing.md },
  ratingRow: { gap: spacing.xs },
});
