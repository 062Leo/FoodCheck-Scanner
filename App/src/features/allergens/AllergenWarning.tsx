import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '../../types/Product';
import type { TranslateFn } from '../../i18n/useTranslation';
import { allergenName } from '../../i18n/allergenLabels';
import { matchAllergens, type AllergenMatch } from '../../domain/allergens/allergenProfile';
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

/** Warning on the product page when the product declares an allergen from the profile. */
export function AllergenWarning({ product, t }: { product: Product; t: TranslateFn }) {
  const lines = allergenWarningLines(useAllergenMatch(product), t);
  if (lines.length === 0) return null;
  const title = t('allergenWarning.title');
  const source = t('allergenWarning.source');

  return (
    <View
      style={styles.card}
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
    gap: spacing.md,
    backgroundColor: colors.dangerSubtle,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    padding: spacing.lg,
  },
  text: { flex: 1, gap: spacing.xs },
  title: { ...typography.caption, color: colors.text, fontWeight: '700' },
  line: { ...typography.bodyStrong, color: colors.text },
  source: { ...typography.caption, color: colors.textSecondary },
});
