import type { Recall } from '../recall';
import { extractEans } from '../recall';
import { findRecallMatches, NAME_MATCH_MAX_AGE_MS } from '../recallMatch';

const NOW = Date.UTC(2026, 9, 4);
const EAN = '4006381333931';
/** A UPC-A code; the app stores it as EAN-13 with a leading zero. */
const UPC = ['0360', '0029', '1452'].join('');

function recall(overrides: Partial<Recall> = {}): Recall {
  return {
    id: 'r1',
    title: 'Sesampaste (Tahina), 12x800 Gramm',
    productName: 'Sesampaste (Tahina), Marke: Chtoura Garden, 12x800 Gramm',
    brand: 'Chtoura Garden',
    manufacturer: 'Beispielfirma',
    reason: 'Krankheitserreger',
    publishedAt: NOW - 2 * 24 * 60 * 60 * 1000,
    link: 'https://www.lebensmittelwarnung.de/meldung.html',
    imageUrl: null,
    states: [],
    eans: [],
    ...overrides,
  };
}

describe('extractEans', () => {
  it('takes valid barcodes after EAN or GTIN only', () => {
    expect(
      extractEans(`Los 12345678 EAN-Codes: 5060193938806 / 5060193938783, GTIN${EAN}`)
    ).toEqual(['5060193938806', '5060193938783', EAN]);
    expect(extractEans('Charge 4006381333932')).toEqual([]);
    expect(extractEans('EAN: 40614223915')).toEqual([]);
  });

  it('normalizes UPC-A and 14-digit GTINs', () => {
    expect(extractEans(`GTIN 0${EAN}`)).toEqual([EAN]);
    expect(extractEans(`EAN ${UPC}`)).toEqual([`0${UPC}`]);
  });
});

describe('findRecallMatches', () => {
  it('matches by barcode regardless of the name', () => {
    const product = { ean: EAN, name: 'Etwas anderes', brand: 'Andere' };
    const matches = findRecallMatches(product, [recall({ eans: [EAN] })], NOW);
    expect(matches).toEqual([expect.objectContaining({ kind: 'ean' })]);
  });

  it('does not match by name when the warning lists other barcodes', () => {
    const product = { ean: EAN, name: 'Sesampaste Tahina', brand: 'Chtoura Garden' };
    expect(findRecallMatches(product, [recall({ eans: ['5060193938806'] })], NOW)).toEqual([]);
  });

  it('matches by brand and the distinctive words of the name', () => {
    const product = { ean: '1', name: 'Sesampaste Tahina', brand: 'Chtoura Garden, Andere' };
    expect(findRecallMatches(product, [recall()], NOW)).toEqual([
      expect.objectContaining({ kind: 'name' }),
    ]);
  });

  it('stays quiet when only the brand or only the name fits', () => {
    const otherProduct = { ean: '1', name: 'Kichererbsen Hummus', brand: 'Chtoura Garden' };
    const otherBrand = { ean: '1', name: 'Sesampaste Tahina', brand: 'Andere Marke' };
    const noBrand = { ean: '1', name: 'Sesampaste Tahina', brand: undefined };
    expect(findRecallMatches(otherProduct, [recall()], NOW)).toEqual([]);
    expect(findRecallMatches(otherBrand, [recall()], NOW)).toEqual([]);
    expect(findRecallMatches(noBrand, [recall()], NOW)).toEqual([]);
  });

  it('needs two name words when the name has several', () => {
    const product = { ean: '1', name: 'Sesampaste geröstet Dunkel', brand: 'Chtoura Garden' };
    expect(findRecallMatches(product, [recall()], NOW)).toEqual([]);
  });

  it('ignores old warnings for name matches', () => {
    const product = { ean: '1', name: 'Sesampaste Tahina', brand: 'Chtoura Garden' };
    const old = recall({ publishedAt: NOW - NAME_MATCH_MAX_AGE_MS - 1 });
    expect(findRecallMatches(product, [old], NOW)).toEqual([]);
  });
});
