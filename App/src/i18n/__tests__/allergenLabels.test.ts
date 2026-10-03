import { allergenLabel, allergenList } from '../allergenLabels';
import { createTranslator } from '../useTranslation';

const de = createTranslator('de');
const en = createTranslator('en');

describe('allergenLabel', () => {
  it('translates the EU allergen tags', () => {
    expect(allergenLabel('en:nuts', de)).toBe('Schalenfrüchte (Nüsse)');
    expect(allergenLabel('en:soybeans', de)).toBe('Soja');
    expect(allergenLabel('en:sulphur-dioxide-and-sulphites', en)).toBe(
      'Sulphur dioxide and sulphites'
    );
  });

  it('keeps unknown tags readable', () => {
    expect(allergenLabel('de:haselnuss-kerne', de)).toBe('Haselnuss kerne');
  });

  it('leaves free text untouched', () => {
    expect(allergenLabel(' Weizen-Gluten ', de)).toBe('Weizen-Gluten');
  });
});

describe('allergenList', () => {
  it('joins tags and removes duplicates', () => {
    expect(allergenList(['en:milk', 'en:nuts', 'en:soybeans'], de)).toBe(
      'Milch, Schalenfrüchte (Nüsse), Soja'
    );
    expect(allergenList(['en:milk', 'en:milk'], de)).toBe('Milch');
  });

  it('splits the traces field', () => {
    expect(allergenList('en:milk,en:peanuts', de)).toBe('Milch, Erdnüsse');
    expect(allergenList('milk, nuts, Sesame seeds', de)).toBe(
      'Milch, Schalenfrüchte (Nüsse), Sesam'
    );
    expect(allergenList(undefined, de)).toBe('');
  });
});
