import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TranslateFn } from '../../i18n/useTranslation';
import type { SupportedLanguage } from '../../i18n/translations';
import type { CompanyData } from '../../domain/analysis/companyRules';
import {
  collectCompanyNames,
  CompanyLookupError,
  searchCompanies,
  type CompanyCandidate,
} from '../../services/CompanyLookupService';
import { Button } from '../../ui/components';
import { FormField } from '../../ui/FormField';
import { colors, radius, spacing, typography, TOUCH_TARGET } from '../../ui/theme';

/** Names shown before the list is cut off with "… and N more". */
export const VISIBLE_NAMES = 30;

/**
 * Name of an avoided brand or company, with an optional Wikidata lookup of the brands
 * and companies that belong to it.
 */
export function CompanyRuleForm({
  name,
  data,
  language,
  t,
  onChange,
  onBusyChange,
}: {
  name: string;
  data: CompanyData | null;
  language: SupportedLanguage;
  t: TranslateFn;
  onChange: (changes: { companyName?: string; companyData?: CompanyData | null }) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [candidates, setCandidates] = useState<CompanyCandidate[] | null>(null);
  const [busy, setBusy] = useState<'search' | 'collect' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNames, setShowNames] = useState(false);
  const request = useRef<AbortController | null>(null);

  // A lookup still running when the sheet closes is cancelled.
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    onBusyChange(busy !== null);
    // Closing the sheet or switching the tab must not leave saving blocked.
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  const run = async <T,>(
    kind: 'search' | 'collect',
    task: (signal: AbortSignal) => Promise<T>
  ): Promise<T | null> => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(kind);
    setError(null);
    try {
      return await task(controller.signal);
    } catch (lookupError) {
      if (!controller.signal.aborted) {
        console.warn('Company lookup failed:', lookupError);
        // Without a connection the user can retry later; other failures are Wikidata's.
        const unreachable =
          !(lookupError instanceof CompanyLookupError) ||
          lookupError.reason === 'network' ||
          lookupError.reason === 'timeout';
        setError(unreachable ? t('filter.company.lookupFailed') : t('filter.company.lookupError'));
      }
      return null;
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(null);
      }
    }
  };

  const search = async () => {
    setCandidates(null);
    const found = await run('search', (signal) => searchCompanies(name, language, { signal }));
    if (found) setCandidates(found);
  };

  const collect = async (wikidataId: string) => {
    setCandidates(null);
    const collected = await run('collect', (signal) => collectCompanyNames(wikidataId, { signal }));
    if (collected) onChange({ companyData: collected });
  };

  const names = data?.names ?? [];
  const hidden = names.length - VISIBLE_NAMES;

  return (
    <>
      <FormField
        label={t('filter.field.companyName')}
        value={name}
        onChangeText={(companyName) => {
          setCandidates(null);
          onChange({ companyName });
        }}
        placeholder={t('filter.field.companyPlaceholder')}
        testID="rule-company-name"
      />
      <Text style={styles.hint}>{t('filter.company.hint')}</Text>

      {data?.wikidataId ? (
        <Button
          title={t('filter.company.refresh')}
          icon="refresh"
          variant="secondary"
          onPress={() => void collect(data.wikidataId!)}
          loading={busy !== null}
          testID="company-refresh"
        />
      ) : (
        <Button
          title={t('filter.company.lookup')}
          icon="search"
          variant="secondary"
          onPress={() => void search()}
          loading={busy !== null}
          disabled={!name.trim()}
          testID="company-lookup"
        />
      )}
      {data?.wikidataId && !candidates ? (
        <Pressable
          onPress={() => void search()}
          disabled={busy !== null || !name.trim()}
          accessibilityRole="button"
          style={styles.link}
        >
          <Text style={styles.linkText}>{t('filter.company.lookup')}</Text>
        </Pressable>
      ) : null}

      {busy === 'collect' ? (
        <View style={styles.row}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.hint}>{t('filter.company.collecting')}</Text>
        </View>
      ) : null}

      {candidates ? (
        <View style={styles.candidates}>
          <Text style={styles.label}>
            {candidates.length > 0 ? t('filter.company.pick') : t('filter.company.noCandidates')}
          </Text>
          {candidates.map((candidate) => (
            <Pressable
              key={candidate.id}
              onPress={() => void collect(candidate.id)}
              style={({ pressed }) => [styles.candidate, pressed && styles.pressed]}
              accessibilityRole="button"
              testID={`company-candidate-${candidate.id}`}
            >
              <Text style={styles.candidateText}>
                {candidate.description
                  ? `${candidate.label} – ${candidate.description}`
                  : candidate.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {names.length > 0 ? (
        <View style={styles.result}>
          <Text style={styles.resultTitle}>
            {names.length === 1
              ? t('filter.company.foundOne')
              : t('filter.company.found', { n: names.length })}
          </Text>
          <Pressable
            onPress={() => setShowNames((shown) => !shown)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showNames }}
            style={styles.link}
          >
            <Text style={styles.linkText}>
              {showNames ? t('filter.company.hideNames') : t('filter.company.showNames')}
            </Text>
          </Pressable>
          {showNames ? (
            <Text style={styles.names}>
              {names.slice(0, VISIBLE_NAMES).join(', ')}
              {hidden > 0 ? ` ${t('filter.company.more', { n: hidden })}` : ''}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.hint}>{t('filter.company.nameOnlyHint')}</Text>
      )}
      <Text style={styles.hint}>{t('filter.company.source')}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.body, color: colors.danger },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  candidates: { gap: spacing.xs },
  candidate: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  candidateText: { ...typography.body, color: colors.text },
  result: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
  },
  resultTitle: { ...typography.bodyStrong, color: colors.text },
  link: { minHeight: TOUCH_TARGET, justifyContent: 'center' },
  linkText: { ...typography.label, color: colors.accent },
  names: { ...typography.caption, color: colors.textSecondary },
});
