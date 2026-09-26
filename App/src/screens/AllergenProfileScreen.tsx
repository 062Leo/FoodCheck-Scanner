import { Fragment, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../i18n/useTranslation';
import { allergenName } from '../i18n/allergenLabels';
import { EU_ALLERGENS, type EuAllergen } from '../domain/allergens/allergenProfile';
import { useAllergenStore } from '../store/allergenStore';
import { Toast } from '../components/Toast';
import { Button, ScreenHeader } from '../ui/components';
import { colors, radius, spacing, typography } from '../ui/theme';

export default function AllergenProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useAllergenStore((s) => s.profile);
  const status = useAllergenStore((s) => s.status);
  const [failed, setFailed] = useState(0);
  const ready = status === 'ready';

  const onToggle = async (allergen: EuAllergen) => {
    if (!(await useAllergenStore.getState().toggle(allergen))) setFailed((count) => count + 1);
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
        {status === 'error' && (
          <View style={styles.error}>
            <Text style={styles.errorText}>{t('allergenProfile.loadFailed')}</Text>
            <Button
              title={t('common.retry')}
              icon="refresh"
              variant="secondary"
              onPress={() => void useAllergenStore.getState().loadProfile()}
            />
          </View>
        )}
        <View style={styles.list}>
          {EU_ALLERGENS.map((allergen, index) => {
            const name = allergenName(allergen, t);
            const selected = profile.includes(allergen);
            return (
              <Fragment key={allergen}>
                {index > 0 && <View style={styles.divider} />}
                {/* The whole row is the switch; the visual Switch is hidden from screen readers. */}
                <Pressable
                  onPress={() => void onToggle(allergen)}
                  disabled={!ready}
                  accessibilityRole="switch"
                  accessibilityLabel={name}
                  accessibilityState={{ checked: selected, disabled: !ready }}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  testID={`allergen-${allergen}`}
                >
                  <Text style={styles.name}>{name}</Text>
                  <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <Switch
                      value={selected}
                      onValueChange={() => void onToggle(allergen)}
                      disabled={!ready}
                      trackColor={{ false: colors.borderStrong, true: colors.accentSubtle }}
                      thumbColor={selected ? colors.accent : colors.textMuted}
                    />
                  </View>
                </Pressable>
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
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  name: { ...typography.body, color: colors.text, flex: 1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.lg,
  },
  error: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSubtle,
  },
  errorText: { ...typography.body, color: colors.text },
});
