import type { Product, ProductNutriments } from '../../types/Product';
import { NUTRIENT_FIELDS, type NutrientField, type ProductFormValues } from './productForm';

const SIMPLE_FIELDS = [
  'name',
  'brand',
  'quantity',
  'categories',
  'servingSize',
  'nova',
  'allergens',
  'traces',
  'origins',
  'manufacturingPlaces',
  'stores',
  'ingredients',
] as const;

export type EditableField = (typeof SIMPLE_FIELDS)[number] | `nutriments.${NutrientField}`;

export const EDITABLE_FIELDS: readonly EditableField[] = [
  ...SIMPLE_FIELDS,
  ...NUTRIENT_FIELDS.map((f) => `nutriments.${f.key}` as const),
];

/** Fields the user edited on this device; 'all' for edits made before tracking existed. */
export type EditedFields = ReadonlySet<EditableField> | 'all';

/** Product properties that hold each form field. */
const PRODUCT_PROPERTIES: Record<(typeof SIMPLE_FIELDS)[number], (keyof Product)[]> = {
  name: ['name'],
  brand: ['brand'],
  quantity: ['quantity'],
  categories: ['categories'],
  servingSize: ['servingSize'],
  nova: ['novaScore'],
  allergens: ['allergensTags'],
  traces: ['traces'],
  origins: ['origins'],
  manufacturingPlaces: ['manufacturingPlaces'],
  stores: ['stores'],
  ingredients: [
    'ingredientsText',
    'ingredientsTextDe',
    'ingredientsTextEn',
    'ingredientsTextByLang',
  ],
};

export function parseEditedFields(
  json: string | null | undefined,
  editedAt: string | null | undefined
): EditedFields | null {
  if (json) {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (Array.isArray(parsed)) {
        return new Set(
          parsed.filter((f): f is EditableField => EDITABLE_FIELDS.includes(f as EditableField))
        );
      }
    } catch {
      // fall through
    }
  }
  return editedAt ? 'all' : null;
}

export function serializeEditedFields(fields: EditedFields): string | null {
  return fields === 'all' ? null : JSON.stringify([...fields].sort());
}

export function mergeEditedFields(
  previous: EditedFields | null,
  changed: Iterable<EditableField>
): EditedFields {
  if (previous === 'all') return 'all';
  return new Set([...(previous ?? []), ...changed]);
}

/** Which fields differ between the form as loaded and as saved. */
export function changedFields(
  before: ProductFormValues,
  after: ProductFormValues
): EditableField[] {
  const changed: EditableField[] = [];
  for (const field of SIMPLE_FIELDS) {
    const a = field === 'ingredients' ? JSON.stringify(sorted(before.ingredients)) : before[field];
    const b = field === 'ingredients' ? JSON.stringify(sorted(after.ingredients)) : after[field];
    if (normalize(a) !== normalize(b)) changed.push(field);
  }
  for (const nutrient of NUTRIENT_FIELDS) {
    if (normalize(before.nutriments[nutrient.key]) !== normalize(after.nutriments[nutrient.key])) {
      changed.push(`nutriments.${nutrient.key}`);
    }
  }
  return changed;
}

function sorted(record: Record<string, string>): [string, string][] {
  return Object.keys(record)
    .sort()
    .map((key) => [key, record[key].trim()] as [string, string])
    .filter(([, value]) => value.length > 0);
}

function normalize(value: string): string {
  return value.trim().replace(',', '.');
}

/** Copies the user's value of every edited field from `local` onto `target`. */
export function applyEditedFields(
  target: Product,
  local: Product,
  fields: ReadonlySet<EditableField>
) {
  const out = target as unknown as Record<string, unknown>;
  const source = local as unknown as Record<string, unknown>;
  let nutriments: ProductNutriments | undefined = target.nutriments
    ? { ...target.nutriments }
    : undefined;

  for (const field of fields) {
    if (field.startsWith('nutriments.')) {
      const key = field.slice('nutriments.'.length) as NutrientField;
      const value = local.nutriments?.[key];
      nutriments = { ...(nutriments ?? {}) };
      if (value === undefined) delete nutriments[key];
      else nutriments[key] = value;
      continue;
    }
    for (const property of PRODUCT_PROPERTIES[field as (typeof SIMPLE_FIELDS)[number]]) {
      out[property] = source[property];
    }
  }

  target.nutriments = nutriments && Object.keys(nutriments).length > 0 ? nutriments : undefined;
}
