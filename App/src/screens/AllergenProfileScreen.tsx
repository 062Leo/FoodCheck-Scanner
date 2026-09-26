import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../i18n/useTranslation';
import { allergenName } from '../i18n/allergenLabels';
import { EU_ALLERGENS, type EuAllergen } from '../domain/allergens/allergenProfile';
import { useAllergenStore } from '../store/allergenStore';
import { Toast } from '../components/Toast';
import { ListRow, ScreenHeader } from '../ui/components';
import { colors, radius, spacing, typography } from '../ui/theme';

export default function AllergenProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useAllergenStore((s) => s.profile);
  const toggle = useAllergenStore((s) => s.toggle);
  const [failed, setFailed] = useState(0);

  const onToggle = async (allergen: EuAllergen) => {
    if (!(await toggle(allergen))) setFailed((count) => count + 1);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('allergenProfile.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.body}>{t('allergenProfile.intro')}</Text>
        <View style={styles.list}>
          {EU_ALLERGENS.map((allergen, index) => {
            const name = allergenName(allergen, t);
            const selected = profile.includes(allergen);
            return (
              <Fragment key={allergen}>
                {index > 0 && <View style={styles.divider} />}
                <ListRow
                  title={name}
                  end={
                    <Switch
                      value={selected}
                      onValueChange={() => void onToggle(allergen)}
                      trackColor={{ false: colors.borderStrong, true: colors.accentSubtle }}
                      thumbColor={selected ? colors.accent : colors.textMuted}
                      accessibilityLabel={name}
                      testID={`allergen-${allergen}`}
                    />
                  }
                />
              </Fragment>
            );
          })}
        </View>
        <Text style={styles.muted}>{t('allergenProfile.disclaimer')}</Text>
      </ScrollView>
      {failed > 0 && (
        <Toast
          key={failed}
          message={t('allergenProfile.saveFailed')}
          type="error"
          onDismiss={() => setFailed(0)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  body: { ...typography.body, color: colors.textSecondary },
  muted: { ...typography.caption, color: colors.textMuted },
  list: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.lg,
  },
});
