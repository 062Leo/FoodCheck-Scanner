import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '../../types/Product';
import type { TranslateFn } from '../../i18n/useTranslation';
import { allergenName } from '../../i18n/allergenLabels';
import {
  hasAllergenMatch,
  matchAllergens,
  type AllergenMatch,
} from '../../domain/allergens/allergenProfile';
import { useAllergenStore } from '../../store/allergenStore';
import { colors, radius, spacing, typography } from '../../ui/theme';

/** Allergens from the user's profile that the product declares. */
export function useAllergenMatch(product: Product): AllergenMatch {
  const profile = useAllergenStore((s) => s.profile);
  return matchAllergens(product, profile);
}

/** "Enthält Milch" / "Kann Spuren enthalten: Erdnüsse", one line per kind. */
export function allergenWarningLines(match: AllergenMatch, t: TranslateFn): string[] {
  const names = (list: AllergenMatch['contains']) =>
    list.map((allergen) => allergenName(allergen, t)).join(', ');
  const lines: string[] = [];
  if (match.contains.length > 0) {
    lines.push(t('allergenWarning.contains', { list: names(match.contains) }));
  }
  if (match.traces.length > 0) {
    lines.push(t('allergenWarning.traces', { list: names(match.traces) }));
  }
  return lines;
}

/** Everything a screen reader should say about allergens, most important first. */
export function allergenAnnouncement(match: AllergenMatch, t: TranslateFn): string[] {
  if (hasAllergenMatch(match)) return allergenWarningLines(match, t);
  return match.noData ? [t('allergenWarning.noData')] : [];
}

/**
 * On the product page: a warning when the product declares an allergen from the profile,
 * or a neutral note when a profile is set but Open Food Facts has no allergen data.
 */
export function AllergenWarning({ product, t }: { product: Product; t: TranslateFn }) {
  const match = useAllergenMatch(product);

  if (!hasAllergenMatch(match)) {
    if (!match.noData) return null;
    const note = t('allergenWarning.noData');
    return (
      <View
        style={[styles.card, styles.noteCard]}
        accessible
        accessibilityLabel={note}
        testID="allergen-no-data"
      >
        <Ionicons name="information-circle-outline" size={24} color={colors.textSecondary} />
        <Text style={[styles.source, styles.text]}>{note}</Text>
      </View>
    );
  }

  const lines = allergenWarningLines(match, t);
  const title = t('allergenWarning.title');
  const source = t('allergenWarning.source');
  return (
    <View
      style={[styles.card, styles.warningCard]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={[title, ...lines, source].join('. ')}
      testID="allergen-warning"
    >
      <Ionicons name="warning" size={28} color={colors.danger} />
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {lines.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
        <Text style={styles.source}>{source}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.lg,
  },
  warningCard: { backgroundColor: colors.dangerSubtle, borderLeftColor: colors.danger },
  noteCard: { backgroundColor: colors.surface, borderLeftColor: colors.borderStrong },
  text: { flex: 1, gap: spacing.xs },
  title: { ...typography.caption, color: colors.text, fontWeight: '700' },
  line: { ...typography.bodyStrong, color: colors.text },
  source: { ...typography.caption, color: colors.textSecondary },
});
