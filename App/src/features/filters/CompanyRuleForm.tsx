import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TranslateFn } from '../../i18n/useTranslation';
import type { SupportedLanguage } from '../../i18n/translations';
import {
  activeCompanyNameCount,
  companyWords,
  isExcludedCompanyName,
  isOwnCompanyName,
  keepExclusions,
  toggleCompanyName,
  type CompanyData,
} from '../../domain/analysis/companyRules';
import {
  collectCompanyNames,
  CompanyLookupError,
  searchCompanies,
  type CompanyCandidate,
} from '../../services/CompanyLookupService';
import { Button } from '../../ui/components';
import { FormField } from '../../ui/FormField';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, TOUCH_TARGET } from '../../ui/theme';

/**
 * Names rendered per page. The sheet is a ScrollView, so the list is plain rows paged
 * in steps (a FlatList there would be a nested VirtualizedList).
 */
export const NAMES_PAGE_SIZE = 50;

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
  const [nameFilter, setNameFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(NAMES_PAGE_SIZE);
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
    // A refresh keeps the user's exclusions for names that are still collected.
    if (collected) onChange({ companyData: keepExclusions(data, collected) });
  };

  const names = data?.names ?? [];
  const filterWords = companyWords(nameFilter).join('');
  const filtered = filterWords
    ? names.filter((entry) => companyWords(entry).join('').includes(filterWords))
    : names;
  const shown = filtered.slice(0, visibleCount);
  const hidden = filtered.length - shown.length;

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
            <>
              <Text style={styles.label} testID="company-active-count">
                {t('filter.company.active', {
                  active: activeCompanyNameCount(data),
                  total: names.length,
                })}
              </Text>
              <Text style={styles.hint}>{t('filter.company.toggleHint')}</Text>
              {names.length > NAMES_PAGE_SIZE ? (
                <FormField
                  label={t('filter.company.filter')}
                  value={nameFilter}
                  onChangeText={(text) => {
                    setNameFilter(text);
                    setVisibleCount(NAMES_PAGE_SIZE);
                  }}
                  testID="company-names-filter"
                />
              ) : null}
              {shown.map((entry, index) => {
                const own = isOwnCompanyName(entry, name);
                const active = own || !isExcludedCompanyName(data, entry);
                return (
                  <Pressable
                    key={`${index}-${entry}`}
                    onPress={() =>
                      data && onChange({ companyData: toggleCompanyName(data, entry, name) })
                    }
                    disabled={own}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active, disabled: own }}
                    accessibilityLabel={own ? `${entry}, ${t('filter.company.ownName')}` : entry}
                    style={({ pressed }) => [styles.nameRow, pressed && styles.pressed]}
                    testID={`company-name-${entry}`}
                  >
                    <Ionicons
                      name={active ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={active ? colors.accent : colors.textMuted}
                    />
                    <Text style={[styles.nameText, !active && styles.nameOff]}>
                      {entry}
                      {own ? ` (${t('filter.company.ownName')})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
              {hidden > 0 ? (
                <Pressable
                  onPress={() => setVisibleCount((count) => count + NAMES_PAGE_SIZE)}
                  accessibilityRole="button"
                  style={styles.link}
                  testID="company-show-more"
                >
                  <Text style={styles.linkText}>
                    {t('filter.company.showMore', { n: Math.min(hidden, NAMES_PAGE_SIZE) })}
                  </Text>
                </Pressable>
              ) : null}
            </>
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
  nameRow: {
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
  },
  nameText: { ...typography.body, color: colors.text, flex: 1 },
  nameOff: { color: colors.textMuted, textDecorationLine: 'line-through' },
});
