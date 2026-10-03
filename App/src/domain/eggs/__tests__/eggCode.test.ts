import { compactEggCode, parseEggCode, type EggCodeError } from '../eggCode';

function parsed(input: string) {
  const result = parseEggCode(input);
  if (!result.ok) throw new Error(`expected a valid code, got ${result.error}`);
  return result.code;
}

function errorOf(input: string): EggCodeError | undefined {
  const result = parseEggCode(input);
  return result.ok ? undefined : result.error;
}

describe('parseEggCode', () => {
  it('reads a German code with state, farm and stall', () => {
    expect(parseEggCode('0-DE-0312345')).toEqual({
      ok: true,
      code: {
        housing: 0,
        country: 'DE',
        region: { code: '03', state: 'NI' },
        farmId: '1234',
        stall: '5',
        raw: '0-DE-0312345',
        normalized: '0-DE-0312345',
      },
    });
  });

  it.each([
    ['0-DE-0312345', 0],
    ['1-DE-0312345', 1],
    ['2-DE-0312345', 2],
    ['3-DE-0312345', 3],
  ])('reads the housing digit of %s', (input, housing) => {
    expect(parsed(input).housing).toBe(housing);
  });

  it.each([
    '0-DE-0312345',
    '0 DE 0312345',
    '0DE0312345',
    '0de0312345',
    ' 0 - de - 031 2345 ',
    '0–DE–0312345',
    '0--DE--03-1234-5',
    '0.DE.0312345',
  ])('tolerates case and separators in "%s"', (input) => {
    const code = parsed(input);
    expect(code.normalized).toBe('0-DE-0312345');
    expect(code.raw).toBe(input);
  });

  it.each([
    ['01', 'SH'],
    ['02', 'HH'],
    ['03', 'NI'],
    ['04', 'HB'],
    ['05', 'NW'],
    ['06', 'HE'],
    ['07', 'RP'],
    ['08', 'BW'],
    ['09', 'BY'],
    ['10', 'SL'],
    ['11', 'BE'],
    ['12', 'BB'],
    ['13', 'MV'],
    ['14', 'SN'],
    ['15', 'ST'],
    ['16', 'TH'],
  ])('maps state number %s to %s', (number, state) => {
    expect(parsed(`1-DE-${number}12345`).region).toEqual({ code: number, state });
  });

  it('splits Bavarian and Thuringian codes into farm and stall', () => {
    expect(parsed('2-DE-0987654')).toMatchObject({
      region: { code: '09', state: 'BY' },
      farmId: '8765',
      stall: '4',
    });
    expect(parsed('3-DE-1600011')).toMatchObject({
      region: { code: '16', state: 'TH' },
      farmId: '0001',
      stall: '1',
    });
  });

  it.each(['00', '17', '99'])('rejects the unknown state number %s', (number) => {
    expect(errorOf(`0-DE-${number}12345`)).toBe('unknownState');
  });

  it('keeps the rest of a code from another country as the farm id', () => {
    expect(parsed('1-AT-1234567')).toEqual({
      housing: 1,
      country: 'AT',
      farmId: '1234567',
      raw: '1-AT-1234567',
      normalized: '1-AT-1234567',
    });
    expect(parsed('2 fr abc 01')).toMatchObject({ country: 'FR', farmId: 'ABC01' });
    expect(parsed('0-NL-4012345').region).toBeUndefined();
    expect(parsed('1-UK-12345')).toMatchObject({ country: 'UK' });
  });

  it.each<[string, EggCodeError]>([
    ['', 'empty'],
    ['  - ', 'empty'],
    ['DE0312345', 'missingHousing'],
    ['4-DE-0312345', 'invalidHousing'],
    ['9DE0312345', 'invalidHousing'],
    ['0', 'tooShort'],
    ['0D', 'tooShort'],
    ['0-DE', 'tooShort'],
    ['0-DE-031234', 'tooShort'],
    ['0-DE-03123456', 'tooLong'],
    ['0-D3-0312345', 'invalidCountry'],
    ['0-03-12345', 'invalidCountry'],
    ['0-XX-0312345', 'unknownCountry'],
    ['0-DE-03A2345', 'invalidFarmNumber'],
    ['0/DE/0312345', 'invalidCharacters'],
  ])('rejects "%s" as %s', (input, error) => {
    expect(parseEggCode(input)).toEqual({ ok: false, error, raw: input });
  });
});

describe('compactEggCode', () => {
  it('removes separators and upper-cases', () => {
    expect(compactEggCode(' 0 - de - 031 2345 ')).toBe('0DE0312345');
  });
});
