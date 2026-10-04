import { useState, type ComponentProps } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../i18n/useTranslation';
import type { TranslationKey } from '../i18n/translations';
import { countryName, germanStateName } from '../i18n/countryNames';
import {
  compactEggCode,
  parseEggCode,
  type EggCodeResult,
  type EggHousing,
} from '../domain/eggs/eggCode';
import { Card, ScreenHeader, SectionTitle } from '../ui/components';
import { FormField } from '../ui/FormField';
import { STATUS_ICONS } from '../ui/status';
import { colors, radius, spacing, typography } from '../ui/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Colour and icon per housing system: organic good, free range neutral, barn and cage bad. */
const HOUSING_TONES: Record<EggHousing, { color: string; icon: IconName }> = {
  0: { color: colors.status.OK, icon: STATUS_ICONS.OK },
  1: { color: colors.textSecondary, icon: 'remove-circle' },
  2: { color: colors.status.Warning, icon: STATUS_ICONS.Warning },
  3: { color: colors.status.Critical, icon: STATUS_ICONS.Critical },
};

/** Not on the first characters, and "too short" only once the code is nearly complete. */
function visibleError(input: string, result: EggCodeResult): TranslationKey | undefined {
  if (result.ok || result.error === 'empty') return undefined;
  const length = compactEggCode(input).length;
  if (length < 3 || (result.error === 'tooShort' && length < 8)) return undefined;
  return `eggCode.error.${result.error}` as TranslationKey;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function EggCodeScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [input, setInput] = useState('');
  const result = parseEggCode(input);
  const error = visibleError(input, result);
  const code = result.ok ? result.code : undefined;
  const tone = code ? HOUSING_TONES[code.housing] : undefined;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('eggCode.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FormField
            label={t('eggCode.inputLabel')}
            value={input}
            onChangeText={(value) => setInput(value.toUpperCase())}
            placeholder="0-DE-0312345"
            hint={t('eggCode.inputHint')}
            error={error ? t(error) : undefined}
            code
            testID="egg-code-input"
          />

          {code && tone ? (
            <>
              <View
                style={[styles.housing, { borderColor: tone.color }]}
                accessible
                accessibilityLiveRegion="polite"
                testID="egg-code-housing"
              >
                <View style={styles.housingTitleRow}>
                  <Ionicons name={tone.icon} size={28} color={tone.color} />
                  <Text style={[styles.housingTitle, { color: tone.color }]}>
                    {t(`eggCode.housing.${code.housing}.assessment` as TranslationKey)}
                  </Text>
                </View>
                <Text style={styles.housingName}>
                  {t('eggCode.housingLabel', {
                    housing: code.housing,
                    name: t(`eggCode.housing.${code.housing}.name` as TranslationKey),
                  })}
                </Text>
                <Text style={styles.body}>
                  {t(`eggCode.housing.${code.housing}.detail` as TranslationKey)}
                </Text>
              </View>

              <Card style={styles.details}>
                <InfoRow label={t('eggCode.code')} value={code.normalized} />
                <InfoRow
                  label={t('eggCode.country')}
                  value={`${countryName(code.country, language)} (${code.country})`}
                />
                {code.region ? (
                  <InfoRow
                    label={t('eggCode.state')}
                    value={`${germanStateName(code.region.state, language)} (${code.region.code})`}
                  />
                ) : null}
                <InfoRow label={t('eggCode.farm')} value={code.farmId} />
                {code.stall ? <InfoRow label={t('eggCode.stall')} value={code.stall} /> : null}
              </Card>
            </>
          ) : null}

          <View style={styles.section}>
            <SectionTitle>{t('eggCode.structureTitle')}</SectionTitle>
            <Card>
              <Text style={styles.body}>{t('eggCode.structure')}</Text>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  section: { gap: spacing.xs },
  housing: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  housingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  housingTitle: { ...typography.title, flexShrink: 1 },
  housingName: { ...typography.bodyStrong, color: colors.text },
  details: { gap: spacing.md },
  infoRow: { gap: 2 },
  infoLabel: { ...typography.caption, color: colors.textMuted },
  infoValue: { ...typography.body, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary },
});
