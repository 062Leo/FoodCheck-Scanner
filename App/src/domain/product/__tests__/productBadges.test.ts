import type { Product } from '../../../types/Product';
import { productBadges } from '../productBadges';
import { mentionsRawMilk } from '../rawMilk';

function product(overrides: Partial<Product> = {}): Product {
  return { ean: '4000000000001', name: 'Test', ...overrides };
}

const kinds = (p: Product) => productBadges(p).map((badge) => badge.kind);

describe('productBadges', () => {
  it('shows nothing without labels', () => {
    expect(productBadges(product())).toEqual([]);
    expect(productBadges(product({ labelsTags: ['en:vegan', 'en:gluten-free'] }))).toEqual([]);
  });

  it('shows one organic badge for organic labels and control body codes', () => {
    expect(kinds(product({ labelsTags: ['en:organic'] }))).toEqual(['organic']);
    expect(kinds(product({ labelsTags: ['en:organic', 'en:eu-organic'] }))).toEqual(['organic']);
    expect(kinds(product({ labelsTags: ['en:de-oko-001'] }))).toEqual(['organic']);
    expect(kinds(product({ labelsTags: ['en:es-eco-002-an'] }))).toEqual(['organic']);
  });

  it('names the organic association once, without a second organic badge', () => {
    const badges = productBadges(
      product({
        labelsTags: ['en:organic', 'en:eu-organic', 'en:biodynamic-agriculture', 'en:demeter'],
      })
    );
    expect(badges).toEqual([{ kind: 'organic', tone: 'positive', associations: ['Demeter'] }]);
    expect(productBadges(product({ labelsTags: ['en:bioland', 'en:naturland-fair'] }))).toEqual([
      { kind: 'organic', tone: 'positive', associations: ['Bioland', 'Naturland'] },
    ]);
  });

  it('recognises GMO-free labels including feed without GMOs', () => {
    expect(kinds(product({ labelsTags: ['en:no-gmos', 'de:ohne-gentechnik'] }))).toEqual(['noGmo']);
    expect(kinds(product({ labelsTags: ['de:ohne-gentechnik-hergestellt'] }))).toEqual(['noGmo']);
    expect(kinds(product({ labelsTags: ['en:fed-without-gmos'] }))).toEqual(['noGmo']);
    expect(kinds(product({ labelsTags: ['en:eggs-from-animals-fed-without-gmos'] }))).toEqual([
      'noGmo',
    ]);
  });

  it('warns about products that contain GMOs', () => {
    expect(productBadges(product({ labelsTags: ['en:contains-gmos'] }))).toEqual([
      { kind: 'containsGmo', tone: 'warning' },
    ]);
  });

  it('styles the husbandry levels by animal welfare', () => {
    const tone = (tag: string) => productBadges(product({ labelsTags: [tag] }))[0];
    expect(tone('de:haltungsform-1-stall')).toEqual({
      kind: 'husbandry',
      tone: 'warning',
      level: 1,
    });
    expect(tone('de:haltungsform-2-stall-platz')).toMatchObject({ tone: 'warning', level: 2 });
    expect(tone('de:haltungsform-3-frischluftklima')).toMatchObject({ tone: 'neutral', level: 3 });
    expect(tone('de:haltungsform-4-auslauf-weide')).toMatchObject({ tone: 'positive', level: 4 });
    expect(tone('de:haltungsform-5-bio')).toMatchObject({ tone: 'positive', level: 5 });
    expect(productBadges(product({ labelsTags: ['de:haltungsform'] }))).toEqual([]);
  });

  it('recognises older Haltungsform labels in any case', () => {
    const tone = (tag: string) => productBadges(product({ labelsTags: [tag] }))[0];
    expect(tone('de:Haltungsform-4-premium')).toMatchObject({ tone: 'positive', level: 4 });
    expect(tone('de:haltungsform-1-stallhaltung')).toMatchObject({ tone: 'warning', level: 1 });
    expect(tone('de:haltungsform-2-stallhaltungplus')).toMatchObject({ level: 2 });
    expect(tone('de:Haltungsform-3-aussenklima')).toMatchObject({ tone: 'neutral', level: 3 });
    expect(tone('de:HALTUNGSFORM-5-BIO')).toMatchObject({ level: 5 });
  });

  it('recognises free range, MSC and ASC', () => {
    expect(kinds(product({ labelsTags: ['en:free-range', 'en:free-range-eggs'] }))).toEqual([
      'freeRange',
    ]);
    expect(kinds(product({ labelsTags: ['en:made-with-free-range-eggs'] }))).toEqual(['freeRange']);
    expect(
      productBadges(
        product({ labelsTags: ['en:sustainable-fishery', 'en:sustainable-seafood-msc'] })
      )
    ).toEqual([{ kind: 'msc', tone: 'info' }]);
    expect(
      productBadges(
        product({ labelsTags: ['en:responsible-aquaculture', 'en:responsible-aquaculture-asc'] })
      )
    ).toEqual([{ kind: 'asc', tone: 'info' }]);
  });

  it('keeps a fixed order', () => {
    expect(
      kinds(
        product({
          labelsTags: [
            'en:sustainable-seafood-msc',
            'de:haltungsform-4-auslauf-weide',
            'de:ohne-gentechnik',
            'en:organic',
          ],
          ingredientsText: 'Rohmilch',
        })
      )
    ).toEqual(['organic', 'noGmo', 'husbandry', 'msc', 'rawMilk']);
  });

  it('shows raw milk from the ingredient text or the category', () => {
    expect(kinds(product({ ingredientsText: 'Rohmilch, Salz, Lab' }))).toEqual(['rawMilk']);
    expect(kinds(product({ ingredientsText: 'Lait cru de vache, sel' }))).toEqual(['rawMilk']);
    expect(kinds(product({ categoriesTags: ['en:cheeses', 'en:unpasteurised-cheeses'] }))).toEqual([
      'rawMilk',
    ]);
  });
});

describe('mentionsRawMilk', () => {
  it.each([
    'Rohmilch',
    'Käse aus Rohmilch hergestellt',
    'Rohmilchkäse',
    'Made with raw milk',
    'lait cru',
    'latte crudo di vacca',
    'leche cruda de oveja',
    'rauwe melk',
    'Pasteurisierte Milch, Rohmilch',
  ])('finds "%s"', (text) => {
    expect(mentionsRawMilk(text)).toBe(true);
  });

  it.each([
    'Nicht aus Rohmilch hergestellt',
    'Milch (nicht aus Rohmilch)',
    'Ohne Rohmilch',
    'Not made with raw milk',
    'Fabriqué sans lait cru',
    'Pasteurisierte Milch',
    '',
  ])('ignores "%s"', (text) => {
    expect(mentionsRawMilk(text)).toBe(false);
  });
});
