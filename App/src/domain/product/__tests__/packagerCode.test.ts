import { parsePackagerCode, parsePackagerCodes } from '../packagerCode';
import { countryName, describePackagerCode } from '../../../i18n/countryNames';

describe('parsePackagerCode', () => {
  it('reads a German code with its state', () => {
    expect(parsePackagerCode('de-by-123-eg')).toEqual({
      raw: 'de-by-123-eg',
      formatted: 'DE BY 123 EG',
      country: 'DE',
      region: 'BY',
    });
    expect(parsePackagerCode('de-nw-40404-ec')).toMatchObject({ country: 'DE', region: 'NW' });
    expect(parsePackagerCode('DE BW-12345 EG')).toMatchObject({
      formatted: 'DE BW 12345 EG',
      region: 'BW',
    });
  });

  it('leaves out an unknown German state', () => {
    expect(parsePackagerCode('de-xx-123-eg')).toEqual({
      raw: 'de-xx-123-eg',
      formatted: 'DE XX 123 EG',
      country: 'DE',
    });
  });

  it('reads codes of other countries without a region', () => {
    expect(parsePackagerCode('fr-29-123-001-ce')).toEqual({
      raw: 'fr-29-123-001-ce',
      formatted: 'FR 29 123 001 CE',
      country: 'FR',
    });
    expect(parsePackagerCode('it-1234-ce')).toMatchObject({ country: 'IT' });
    expect(parsePackagerCode('be-1234-eg')).toMatchObject({ country: 'BE' });
    expect(parsePackagerCode('FR 56.121.001 CE')).toMatchObject({
      formatted: 'FR 56 121 001 CE',
      country: 'FR',
    });
    expect(parsePackagerCode('be-1234-eg')?.region).toBeUndefined();
  });

  it('keeps codes without a country prefix as they are', () => {
    expect(parsePackagerCode('emb-29123')).toEqual({ raw: 'emb-29123', formatted: 'EMB 29123' });
    expect(parsePackagerCode('de')).toEqual({ raw: 'de', formatted: 'DE' });
    expect(parsePackagerCode('de-by')).toEqual({ raw: 'de-by', formatted: 'DE BY' });
    expect(parsePackagerCode('abc')).toEqual({ raw: 'abc', formatted: 'ABC' });
  });

  it('ignores empty values', () => {
    expect(parsePackagerCode('')).toBeUndefined();
    expect(parsePackagerCode(' - ')).toBeUndefined();
  });

  it('parses a list without duplicates', () => {
    expect(
      parsePackagerCodes(['de-by-123-eg', '', 'DE BY 123 EG', 'fr-29-123-001-ce']).map(
        (code) => code.formatted
      )
    ).toEqual(['DE BY 123 EG', 'FR 29 123 001 CE']);
    expect(parsePackagerCodes(undefined)).toEqual([]);
  });
});

describe('describePackagerCode', () => {
  it('names country and state in the UI language', () => {
    const code = parsePackagerCode('de-by-123-eg')!;
    expect(describePackagerCode(code, 'de')).toBe('Deutschland, Bayern (DE BY 123 EG)');
    expect(describePackagerCode(code, 'en')).toBe('Germany, Bavaria (DE BY 123 EG)');
    expect(describePackagerCode(parsePackagerCode('fr-29-123-001-ce')!, 'de')).toBe(
      'Frankreich (FR 29 123 001 CE)'
    );
  });

  it('falls back to the country code or the plain code', () => {
    expect(describePackagerCode(parsePackagerCode('xy-123-ce')!, 'de')).toBe('XY (XY 123 CE)');
    expect(describePackagerCode(parsePackagerCode('emb-29123')!, 'en')).toBe('EMB 29123');
    expect(countryName('ch', 'de')).toBe('Schweiz');
    expect(countryName('uk', 'en')).toBe('United Kingdom');
  });
});
