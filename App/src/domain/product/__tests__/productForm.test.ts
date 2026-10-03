import {
  applyForm,
  emptyForm,
  formFromProduct,
  formSnapshot,
  parseDecimal,
  toOffPayload,
  validateForUpload,
  validateForm,
} from '../productForm';
import type { Product } from '../../../types/Product';

const product: Product = {
  ean: '4000000000001',
  name: 'Müsli',
  brand: 'Hausmarke',
  ingredientsText: 'Hafer, Zucker',
  ingredientsTextDe: 'Hafer, Zucker',
  ingredientsTextByLang: { fr: 'Avoine, sucre' },
  novaScore: 3,
  nutriments: { sugars100g: 12.5, salt100g: 0.1 },
  allergensTags: ['en:gluten'],
  imageUrl: 'https://images.example/front.jpg',
  nutritionGrades: 'c',
};

describe('parseDecimal', () => {
  it('accepts comma and dot decimals and a less-than sign', () => {
    expect(parseDecimal('12,5')).toEqual({ value: 12.5, lessThan: false });
    expect(parseDecimal(' 12.5 ')).toEqual({ value: 12.5, lessThan: false });
    expect(parseDecimal('<0,5')).toEqual({ value: 0.5, lessThan: true });
  });

  it('distinguishes empty from invalid input', () => {
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
    expect(parseDecimal('-3')).toBeNull();
  });
});

describe('product form', () => {
  it('pre-fills from a product and round-trips without losing data', () => {
    const form = formFromProduct(product);

    expect(form.ingredients).toEqual({ de: 'Hafer, Zucker', fr: 'Avoine, sucre' });
    expect(form.nutriments.sugars100g).toBe('12.5');
    expect(form.nova).toBe('3');
    expect(form.allergens).toBe('gluten');

    const saved = applyForm(product, form);
    expect(saved).toMatchObject({
      name: 'Müsli',
      novaScore: 3,
      nutriments: { sugars100g: 12.5, salt100g: 0.1 },
      imageUrl: product.imageUrl,
      nutritionGrades: 'c',
      ingredientsTextByLang: { de: 'Hafer, Zucker', fr: 'Avoine, sucre' },
    });
  });

  it('removes cleared fields and deleted languages', () => {
    const form = formFromProduct(product);
    form.ingredients = { fr: 'Avoine, sucre' };
    form.nutriments.salt100g = '';
    form.nova = '';
    form.brand = '';

    const saved = applyForm(product, form);

    expect(saved.ingredientsTextDe).toBeUndefined();
    expect(saved.ingredientsTextByLang).toEqual({ fr: 'Avoine, sucre' });
    expect(saved.ingredientsText).toBe('Avoine, sucre');
    expect(saved.nutriments).toEqual({ sugars100g: 12.5 });
    expect(saved.novaScore).toBeUndefined();
    expect(saved.brand).toBeUndefined();
  });

  it('parses German decimal input', () => {
    const form = emptyForm();
    form.nutriments.fat100g = '3,4';
    expect(applyForm({ ean: '1', name: '' }, form).nutriments).toEqual({ fat100g: 3.4 });
  });

  it('validates numbers, ranges, NOVA and the name for uploads', () => {
    const form = emptyForm();
    form.nutriments.fat100g = '1,2,3';
    form.nutriments.sugars100g = '150';
    form.nova = '5';

    expect(validateForUpload(form)).toEqual({
      fat100g: 'number',
      sugars100g: 'range',
      nova: 'nova',
      name: 'required',
    });
  });

  it('detects changes independent of language order', () => {
    const a = emptyForm();
    a.ingredients = { de: 'x', en: 'y' };
    const b = emptyForm();
    b.ingredients = { en: 'y', de: 'x' };
    expect(formSnapshot(a)).toBe(formSnapshot(b));
  });
});

describe('faulty values from Open Food Facts', () => {
  const faulty: Product = {
    ean: '1',
    name: 'Limo',
    nutriments: { salt100g: 1e-7, energyKcal100g: 3700, fat100g: -1 },
  };

  it('shows tiny values in plain notation', () => {
    expect(formFromProduct(faulty).nutriments.salt100g).toBe('0');
  });

  it('does not block saving an unrelated change', () => {
    const initial = formFromProduct(faulty);
    const renamed = { ...initial, name: 'Zitronenlimo' };

    expect(validateForm(renamed, initial)).toEqual({});
    expect(
      validateForm({ ...renamed, nutriments: { ...initial.nutriments, fat100g: 'x' } }, initial)
    ).toEqual({
      fat100g: 'number',
    });
  });
});

describe('toOffPayload', () => {
  it('sends only entered values with correct field names and units', () => {
    const form = formFromProduct(product);
    form.nutriments.salt100g = '<0,5';
    form.nutriments.energyKcal100g = '';

    expect(toOffPayload(form)).toEqual({
      product_name: 'Müsli',
      brands: 'Hausmarke',
      allergens: 'gluten',
      ingredients_text_de: 'Hafer, Zucker',
      ingredients_text_fr: 'Avoine, sucre',
      nutrition_data_per: '100g',
      nutriment_sugars: '12.5',
      nutriment_sugars_unit: 'g',
      nutriment_salt: '<0.5',
      nutriment_salt_unit: 'g',
    });
  });

  it('never sends NaN or a generic ingredients text', () => {
    const form = emptyForm();
    form.name = 'X';
    form.nutriments.fat100g = 'abc';
    const payload = toOffPayload(form);

    expect(JSON.stringify(payload)).not.toContain('NaN');
    expect(payload).not.toHaveProperty('ingredients_text');
    expect(payload).not.toHaveProperty('nutrition_data_per');
  });
});
