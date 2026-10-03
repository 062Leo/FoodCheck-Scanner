import type { GermanState } from '../product/packagerCode';

/**
 * The producer code printed on every egg sold in the EU, e.g. "0-DE-0312345":
 * housing system (0–3), country (ISO 3166-1 alpha-2, "UK"/"EL" as on EU marks) and
 * the farm. German codes go on with a two-digit state number, a four-digit farm
 * number and a one-digit stall number.
 */
export type EggHousing = 0 | 1 | 2 | 3;

export interface EggCodeRegion {
  /** Two-digit state number, e.g. "09". */
  code: string;
  /** State abbreviation, e.g. "BY" for Bavaria. */
  state: GermanState;
}

export interface EggCode {
  housing: EggHousing;
  /** Upper case, e.g. "DE". */
  country: string;
  /** Only for German codes. */
  region?: EggCodeRegion;
  /** German codes: the four-digit farm number; other countries: everything after the country. */
  farmId: string;
  /** Only for German codes. */
  stall?: string;
  /** The input as given. */
  raw: string;
  /** "0-DE-0312345". */
  normalized: string;
}

export type EggCodeError =
  | 'empty'
  | 'missingHousing'
  | 'invalidHousing'
  | 'invalidCountry'
  | 'unknownCountry'
  | 'tooShort'
  | 'tooLong'
  | 'invalidCharacters'
  | 'invalidFarmNumber'
  | 'unknownState';

export type EggCodeResult =
  | { ok: true; code: EggCode }
  | { ok: false; error: EggCodeError; raw: string };

/** Number used in German egg codes for each state. */
const GERMAN_STATE_NUMBERS: Record<string, GermanState> = {
  '01': 'SH',
  '02': 'HH',
  '03': 'NI',
  '04': 'HB',
  '05': 'NW',
  '06': 'HE',
  '07': 'RP',
  '08': 'BW',
  '09': 'BY',
  '10': 'SL',
  '11': 'BE',
  '12': 'BB',
  '13': 'MV',
  '14': 'SN',
  '15': 'ST',
  '16': 'TH',
};

/** ISO 3166-1 alpha-2, plus "UK" and "EL" as EU egg codes use them. */
const COUNTRY_CODES = new Set(
  (
    'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO ' +
    'BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ ' +
    'DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP ' +
    'GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG ' +
    'KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML ' +
    'MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE ' +
    'PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL ' +
    'SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM ' +
    'US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW UK EL'
  ).split(' ')
);

/** Spaces, dashes and dots people type between the parts. */
const SEPARATORS = /[\s\-‐‑‒–—_.]+/g;

/** Upper case without separators, e.g. "0 de 031-2345" → "0DE0312345". */
export function compactEggCode(input: string): string {
  return input.replace(SEPARATORS, '').toUpperCase();
}

/** Parses an egg code typed by the user. */
export function parseEggCode(input: string): EggCodeResult {
  const raw = input;
  const fail = (error: EggCodeError): EggCodeResult => ({ ok: false, error, raw });
  const compact = compactEggCode(input);
  if (!compact) return fail('empty');
  if (/[^A-Z0-9]/.test(compact)) return fail('invalidCharacters');

  const digit = compact[0];
  if (!/\d/.test(digit)) return fail('missingHousing');
  if (!/[0-3]/.test(digit)) return fail('invalidHousing');
  const housing = Number(digit) as EggHousing;

  const country = compact.slice(1, 3);
  if (country.length < 2) return fail('tooShort');
  if (!/^[A-Z]{2}$/.test(country)) return fail('invalidCountry');
  if (!COUNTRY_CODES.has(country)) return fail('unknownCountry');

  const rest = compact.slice(3);
  if (!rest) return fail('tooShort');
  const normalized = `${housing}-${country}-${rest}`;

  if (country !== 'DE') {
    return { ok: true, code: { housing, country, farmId: rest, raw, normalized } };
  }

  if (!/^\d+$/.test(rest)) return fail('invalidFarmNumber');
  if (rest.length < 7) return fail('tooShort');
  if (rest.length > 7) return fail('tooLong');
  const stateNumber = rest.slice(0, 2);
  const state = GERMAN_STATE_NUMBERS[stateNumber];
  if (!state) return fail('unknownState');
  return {
    ok: true,
    code: {
      housing,
      country,
      region: { code: stateNumber, state },
      farmId: rest.slice(2, 6),
      stall: rest.slice(6),
      raw,
      normalized,
    },
  };
}
