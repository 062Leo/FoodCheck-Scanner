import { View, Text, StyleSheet } from 'react-native';
import type { ProductNutriments } from '../types/Product';
import { useTranslation } from '../i18n/useTranslation';
import type { TranslationKey } from '../i18n/translations';

type NutrientKey = keyof ProductNutriments;

interface NutritionRow {
  labelKey: TranslationKey;
  key: NutrientKey;
  unit: string;
}

const NUTRIENT_ROWS: NutritionRow[] = [
  { labelKey: 'product.nutritionEnergy', key: 'energyKcal100g', unit: 'kcal' },
  { labelKey: 'product.nutritionFat', key: 'fat100g', unit: 'g' },
  { labelKey: 'product.nutritionSaturatedFat', key: 'saturatedFat100g', unit: 'g' },
  { labelKey: 'product.nutritionCarbs', key: 'carbohydrates100g', unit: 'g' },
  { labelKey: 'product.nutritionSugar', key: 'sugars100g', unit: 'g' },
  { labelKey: 'product.nutritionFiber', key: 'fiber100g', unit: 'g' },
  { labelKey: 'product.nutritionProtein', key: 'proteins100g', unit: 'g' },
  { labelKey: 'product.nutritionSalt', key: 'salt100g', unit: 'g' },
];

interface NutritionTableProps {
  nutriments: ProductNutriments;
  servingSize?: string;
}

export function NutritionTable({ nutriments, servingSize }: NutritionTableProps) {
  const { t } = useTranslation();
  const hasAnyValue = NUTRIENT_ROWS.some((row) => nutriments[row.key] !== undefined);
  if (!hasAnyValue) return null;

  return (
    <View style={styles.container}>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.cell, styles.headerCell, styles.labelCell]}>
            {t('product.nutritionHeader')}
          </Text>
          <Text style={[styles.cell, styles.headerCell, styles.valueCell]}>
            {t('product.nutritionPer100g')}
          </Text>
        </View>

        {NUTRIENT_ROWS.map((row, index) => {
          const value = nutriments[row.key];
          if (value == null) return null;

          return (
            <View key={row.key} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
              <Text style={[styles.cell, styles.labelCell, styles.labelText]}>
                {t(row.labelKey)}
              </Text>
              <Text style={[styles.cell, styles.valueCell, styles.valueText]}>
                {formatNumber(value)} {row.unit}
              </Text>
            </View>
          );
        })}
      </View>

      {servingSize && (
        <Text style={styles.servingNote}>
          {t('product.nutritionServingSize')}: {servingSize}
        </Text>
      )}
    </View>
  );
}

function formatNumber(value: number): string {
  const formatted = value % 1 === 0 ? value.toString() : value.toFixed(1);
  if (value < 0.1 && value > 0) return '< 0.1';
  return formatted;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  table: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  rowAlt: {
    backgroundColor: '#1A1A1A',
  },
  cell: {
    paddingHorizontal: 12,
    fontSize: 13,
  },
  headerCell: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  labelCell: {
    flex: 2,
  },
  valueCell: {
    flex: 1,
    textAlign: 'right',
  },
  labelText: {
    color: '#BDBDBD',
  },
  valueText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  servingNote: {
    color: '#757575',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'right',
  },
});
