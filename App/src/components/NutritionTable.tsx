import { StyleSheet, Text, View } from 'react-native';
import type { ProductNutriments } from '../types/Product';
import { formatNumber, useTranslation } from '../i18n/useTranslation';
import type { TranslationKey } from '../i18n/translations';
import { colors, radius, spacing, typography } from '../ui/theme';

const NUTRIENT_ROWS: { labelKey: TranslationKey; key: keyof ProductNutriments; unit: string }[] = [
  { labelKey: 'product.nutritionEnergy', key: 'energyKcal100g', unit: 'kcal' },
  { labelKey: 'product.nutritionFat', key: 'fat100g', unit: 'g' },
  { labelKey: 'product.nutritionSaturatedFat', key: 'saturatedFat100g', unit: 'g' },
  { labelKey: 'product.nutritionCarbs', key: 'carbohydrates100g', unit: 'g' },
  { labelKey: 'product.nutritionSugar', key: 'sugars100g', unit: 'g' },
  { labelKey: 'product.nutritionFiber', key: 'fiber100g', unit: 'g' },
  { labelKey: 'product.nutritionProtein', key: 'proteins100g', unit: 'g' },
  { labelKey: 'product.nutritionSalt', key: 'salt100g', unit: 'g' },
];

/** Full nutrition table per 100 g; only rows with a value. */
export function NutritionTable({
  nutriments,
  servingSize,
}: {
  nutriments: ProductNutriments;
  servingSize?: string;
}) {
  const { t, language } = useTranslation();
  const rows = NUTRIENT_ROWS.filter((row) => nutriments[row.key] != null);
  if (rows.length === 0) return null;

  const format = (value: number) =>
    value > 0 && value < 0.1 ? `< ${formatNumber(0.1, language)}` : formatNumber(value, language);

  return (
    <View style={styles.container}>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.cell, styles.header, styles.labelCell]}>
            {t('product.nutritionHeader')}
          </Text>
          <Text style={[styles.cell, styles.header, styles.valueCell]}>
            {t('product.nutritionPer100g')}
          </Text>
        </View>
        {rows.map((row, index) => (
          <View
            key={row.key}
            style={[styles.row, index % 2 === 1 && styles.rowAlt]}
            accessible
            accessibilityLabel={`${t(row.labelKey)}: ${format(nutriments[row.key]!)} ${row.unit}`}
          >
            <Text style={[styles.cell, styles.labelCell, styles.label]}>{t(row.labelKey)}</Text>
            <Text style={[styles.cell, styles.valueCell, styles.value]}>
              {format(nutriments[row.key]!)} {row.unit}
            </Text>
          </View>
        ))}
      </View>
      {servingSize ? (
        <Text style={styles.note}>
          {t('product.nutritionServingSize')}: {servingSize}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  table: { borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceSunken },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    paddingVertical: spacing.sm,
  },
  row: { flexDirection: 'row', paddingVertical: spacing.sm },
  rowAlt: { backgroundColor: colors.bg },
  cell: { ...typography.body, paddingHorizontal: spacing.md },
  header: { fontWeight: '700', color: colors.text },
  labelCell: { flex: 2 },
  valueCell: { flex: 1, textAlign: 'right' },
  label: { color: colors.textSecondary },
  value: { color: colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
  note: { ...typography.caption, color: colors.textMuted, textAlign: 'right' },
});
