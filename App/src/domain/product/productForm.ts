import type { NovaScore, Product, ProductNutriments } from '../../types/Product';
import { hasProductName } from './productName';
import type { EditedFields } from './editedFields';

/** Nutrients editable per 100 g, with plausible upper bounds. */
export const NUTRIENT_FIELDS = [
  { key: 'energyKcal100g', max: 900, unit: 'kcal', off: 'energy-kcal' },
  { key: 'fat100g', max: 100, unit: 'g', off: 'fat' },
  { key: 'saturatedFat100g', max: 100, unit: 'g', off: 'saturated-fat' },
  { key: 'carbohydrates100g', max: 100, unit: 'g', off: 'carbohydrates' },
  { key: 'sugars100g', max: 100, unit: 'g', off: 'sugars' },
  { key: 'fiber100g', max: 100, unit: 'g', off: 'fiber' },
  { key: 'proteins100g', max: 100, unit: 'g', off: 'proteins' },
  { key: 'salt100g', max: 100, unit: 'g', off: 'salt' },
] as const satisfies ReadonlyArray<{
  key: keyof ProductNutriments;
  max: number;
  unit: string;
  off: string;
}>;

export type NutrientField = (typeof NUTRIENT_FIELDS)[number]['key'];

/** The edit form, as typed by the user (all strings). */
export interface ProductFormValues {
  name: string;
  brand: string;
  quantity: string;
  categories: string;
  servingSize: string;
  nova: string;
  allergens: string;
  traces: string;
  origins: string;
  manufacturingPlaces: string;
  stores: string;
  /** Ingredient list per language code. */
  ingredients: Record<string, string>;
  nutriments: Record<NutrientField, string>;
}

export type FormErrorKey = 'number' | 'range' | 'nova' | 'required';
export type FormErrors = Partial<Record<NutrientField | 'nova' | 'name', FormErrorKey>>;

/** Parsed number with an optional "less than" marker ("<0,5"). */
export interface ParsedDecimal {
  value: number;
  lessThan: boolean;
}

/**
 * Parses user input like "12,5", "12.5", "<0,5" or " 3 ". Empty input → undefined,
 * anything else that is not a finite, non-negative number → null.
 */
export function parseDecimal(input: string): ParsedDecimal | undefined | null {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/^(<)?\s*(\d+(?:[.,]\d+)?)$/);
  if (!match) return null;
  const value = Number.parseFloat(match[2].replace(',', '.'));
  return Number.isFinite(value) ? { value, lessThan: Boolean(match[1]) } : null;
}

function formatDecimal(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '';
  // Plain notation: tiny values from OFF would otherwise show as "1e-7".
  return String(Number(value.toFixed(6)));
}

export function emptyForm(): ProductFormValues {
  return {
    name: '',
    brand: '',
    quantity: '',
    categories: '',
    servingSize: '',
    nova: '',
    allergens: '',
    traces: '',
    origins: '',
    manufacturingPlaces: '',
    stores: '',
    ingredients: {},
    nutriments: Object.fromEntries(NUTRIENT_FIELDS.map((f) => [f.key, ''])) as Record<
      NutrientField,
      string
    >,
  };
}

function formatTag(tag: string): string {
  return tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ');
}

/** Pre-fills the form from a stored product. */
export function formFromProduct(product: Product): ProductFormValues {
  const ingredients: Record<string, string> = {};
  const add = (lang: string, text: string | undefined) => {
    if (text?.trim() && !ingredients[lang]) ingredients[lang] = text;
  };
  add('de', product.ingredientsTextDe);
  add('en', product.ingredientsTextEn);
  for (const [lang, text] of Object.entries(product.ingredientsTextByLang ?? {})) add(lang, text);
  if (Object.keys(ingredients).length === 0 && product.ingredientsText?.trim()) {
    ingredients.de = product.ingredientsText;
  }

  const form = emptyForm();
  for (const field of NUTRIENT_FIELDS) {
    form.nutriments[field.key] = formatDecimal(product.nutriments?.[field.key]);
  }

  return {
    ...form,
    name: hasProductName(product.name) ? product.name : '',
    brand: product.brand ?? '',
    quantity: product.quantity ?? '',
    categories: product.categories ?? '',
    servingSize: product.servingSize ?? '',
    nova: product.novaScore ? String(product.novaScore) : '',
    allergens: (product.allergensTags ?? []).map(formatTag).join(', '),
    traces: product.traces ?? '',
    origins: product.origins ?? '',
    manufacturingPlaces: product.manufacturingPlaces ?? '',
    stores: product.stores ?? '',
    ingredients,
  };
}

/**
 * Checks the form. With `initial`, nutrients left as loaded are not checked: a
 * faulty value from Open Food Facts must not block saving an unrelated change.
 */
export function validateForm(values: ProductFormValues, initial?: ProductFormValues): FormErrors {
  const errors: FormErrors = {};
  for (const field of NUTRIENT_FIELDS) {
    const input = values.nutriments[field.key];
    if (initial && input.trim() === initial.nutriments[field.key].trim()) continue;
    const parsed = parseDecimal(input);
    if (parsed === null) errors[field.key] = 'number';
    else if (parsed && parsed.value > field.max) errors[field.key] = 'range';
  }
  if (values.nova.trim() && !/^[1-4]$/.test(values.nova.trim())) errors.nova = 'nova';
  return errors;
}

/** Validation for uploading to Open Food Facts: additionally requires a name. */
export function validateForUpload(
  values: ProductFormValues,
  initial?: ProductFormValues
): FormErrors {
  const errors = validateForm(values, initial);
  if (!values.name.trim()) errors.name = 'required';
  return errors;
}

function nonEmpty(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Applies the form to a product. Fields cleared in the form are removed; languages
 * removed in the form disappear. Everything the form does not cover (images,
 * scores, tags) stays as it was.
 */
export function applyForm(base: Product, values: ProductFormValues): Product {
  const ingredients = Object.fromEntries(
    Object.entries(values.ingredients)
      .map(([lang, text]) => [lang, text.trim()] as const)
      .filter(([, text]) => text.length > 0)
  );
  const nutriments: ProductNutriments = {};
  for (const field of NUTRIENT_FIELDS) {
    const parsed = parseDecimal(values.nutriments[field.key]);
    if (parsed) nutriments[field.key] = parsed.value;
  }
  const nova = /^[1-4]$/.test(values.nova.trim())
    ? (Number(values.nova.trim()) as NovaScore)
    : undefined;
  const primaryIngredients =
    ingredients.de ?? ingredients.en ?? Object.values(ingredients)[0] ?? undefined;

  return {
    ...base,
    name: values.name.trim(),
    brand: nonEmpty(values.brand),
    quantity: nonEmpty(values.quantity),
    categories: nonEmpty(values.categories),
    servingSize: nonEmpty(values.servingSize),
    novaScore: nova,
    allergensTags: values.allergens
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    traces: nonEmpty(values.traces),
    origins: nonEmpty(values.origins),
    manufacturingPlaces: nonEmpty(values.manufacturingPlaces),
    stores: nonEmpty(values.stores),
    ingredientsText: primaryIngredients,
    ingredientsTextDe: ingredients.de,
    ingredientsTextEn: ingredients.en,
    ingredientsTextByLang: ingredients,
    nutriments: Object.keys(nutriments).length > 0 ? nutriments : undefined,
  };
}

/**
 * Fields for the Open Food Facts write API (product_jqm2.pl). Only non-empty values
 * of the given fields are sent: values the user did not enter or change never
 * overwrite data on OFF, not even with an older copy of OFF's own data.
 */
export function toOffPayload(
  values: ProductFormValues,
  fields: EditedFields = 'all',
  /** Ingredient languages to send; all when omitted. */
  ingredientLanguages?: ReadonlySet<string>
): Record<string, string> {
  const payload: Record<string, string> = {};
  const included = (field: string) => fields === 'all' || (fields as Set<string>).has(field);
  const set = (field: keyof ProductFormValues, key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed && included(field)) payload[key] = trimmed;
  };

  set('name', 'product_name', values.name);
  set('brand', 'brands', values.brand);
  set('quantity', 'quantity', values.quantity);
  set('categories', 'categories', values.categories);
  set('servingSize', 'serving_size', values.servingSize);
  set('allergens', 'allergens', values.allergens);
  set('traces', 'traces', values.traces);
  set('origins', 'origins', values.origins);
  set('manufacturingPlaces', 'manufacturing_places', values.manufacturingPlaces);
  set('stores', 'stores', values.stores);
  for (const [lang, text] of Object.entries(values.ingredients)) {
    if (ingredientLanguages && !ingredientLanguages.has(lang)) continue;
    set('ingredients', `ingredients_text_${lang}`, text);
  }

  for (const field of NUTRIENT_FIELDS) {
    const parsed = parseDecimal(values.nutriments[field.key]);
    if (!parsed || !included(`nutriments.${field.key}`)) continue;
    payload.nutrition_data_per = '100g';
    payload[`nutriment_${field.off}`] = `${parsed.lessThan ? '<' : ''}${parsed.value}`;
    payload[`nutriment_${field.off}_unit`] = field.unit;
  }
  return payload;
}

/** Names of the form sections a payload contains, for the confirmation dialog. */
export function payloadSummary(payload: Record<string, string>): string[] {
  const parts: string[] = [];
  if (payload.product_name) parts.push('name');
  if (payload.brands) parts.push('brand');
  const languages = Object.keys(payload)
    .filter((k) => k.startsWith('ingredients_text_'))
    .map((k) => k.replace('ingredients_text_', '').toUpperCase());
  if (languages.length > 0) parts.push(`ingredients:${languages.join(', ')}`);
  if (payload.nutrition_data_per) parts.push('nutrition');
  if (
    [
      'quantity',
      'categories',
      'serving_size',
      'allergens',
      'traces',
      'origins',
      'manufacturing_places',
      'stores',
    ].some((k) => payload[k])
  ) {
    parts.push('details');
  }
  return parts;
}

/** Stable string of the form content, to detect unsaved changes. */
export function formSnapshot(values: ProductFormValues): string {
  const sortedIngredients = Object.keys(values.ingredients)
    .sort()
    .map((lang) => [lang, values.ingredients[lang]]);
  return JSON.stringify({ ...values, ingredients: sortedIngredients });
}
