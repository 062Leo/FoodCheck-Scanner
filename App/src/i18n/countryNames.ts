import type { GermanState, PackagerCode } from '../domain/product/packagerCode';
import type { SupportedLanguage } from './translations';

/**
 * Country names for identification marks: EU and EEA countries, Switzerland and the
 * United Kingdom ("UK" on its marks). A static map because Hermes may lack
 * Intl.DisplayNames.
 */
const COUNTRIES: Record<string, Record<SupportedLanguage, string>> = {
  AT: { de: 'Österreich', en: 'Austria' },
  BE: { de: 'Belgien', en: 'Belgium' },
  BG: { de: 'Bulgarien', en: 'Bulgaria' },
  CH: { de: 'Schweiz', en: 'Switzerland' },
  CY: { de: 'Zypern', en: 'Cyprus' },
  CZ: { de: 'Tschechien', en: 'Czechia' },
  DE: { de: 'Deutschland', en: 'Germany' },
  DK: { de: 'Dänemark', en: 'Denmark' },
  EE: { de: 'Estland', en: 'Estonia' },
  ES: { de: 'Spanien', en: 'Spain' },
  FI: { de: 'Finnland', en: 'Finland' },
  FR: { de: 'Frankreich', en: 'France' },
  GB: { de: 'Vereinigtes Königreich', en: 'United Kingdom' },
  GR: { de: 'Griechenland', en: 'Greece' },
  EL: { de: 'Griechenland', en: 'Greece' },
  HR: { de: 'Kroatien', en: 'Croatia' },
  HU: { de: 'Ungarn', en: 'Hungary' },
  IE: { de: 'Irland', en: 'Ireland' },
  IS: { de: 'Island', en: 'Iceland' },
  IT: { de: 'Italien', en: 'Italy' },
  LI: { de: 'Liechtenstein', en: 'Liechtenstein' },
  LT: { de: 'Litauen', en: 'Lithuania' },
  LU: { de: 'Luxemburg', en: 'Luxembourg' },
  LV: { de: 'Lettland', en: 'Latvia' },
  MT: { de: 'Malta', en: 'Malta' },
  NL: { de: 'Niederlande', en: 'Netherlands' },
  NO: { de: 'Norwegen', en: 'Norway' },
  PL: { de: 'Polen', en: 'Poland' },
  PT: { de: 'Portugal', en: 'Portugal' },
  RO: { de: 'Rumänien', en: 'Romania' },
  SE: { de: 'Schweden', en: 'Sweden' },
  SI: { de: 'Slowenien', en: 'Slovenia' },
  SK: { de: 'Slowakei', en: 'Slovakia' },
  UK: { de: 'Vereinigtes Königreich', en: 'United Kingdom' },
};

const GERMAN_STATE_NAMES: Record<GermanState, Record<SupportedLanguage, string>> = {
  BW: { de: 'Baden-Württemberg', en: 'Baden-Württemberg' },
  BY: { de: 'Bayern', en: 'Bavaria' },
  BE: { de: 'Berlin', en: 'Berlin' },
  BB: { de: 'Brandenburg', en: 'Brandenburg' },
  HB: { de: 'Bremen', en: 'Bremen' },
  HH: { de: 'Hamburg', en: 'Hamburg' },
  HE: { de: 'Hessen', en: 'Hesse' },
  MV: { de: 'Mecklenburg-Vorpommern', en: 'Mecklenburg-Western Pomerania' },
  NI: { de: 'Niedersachsen', en: 'Lower Saxony' },
  NW: { de: 'Nordrhein-Westfalen', en: 'North Rhine-Westphalia' },
  RP: { de: 'Rheinland-Pfalz', en: 'Rhineland-Palatinate' },
  SL: { de: 'Saarland', en: 'Saarland' },
  SN: { de: 'Sachsen', en: 'Saxony' },
  ST: { de: 'Sachsen-Anhalt', en: 'Saxony-Anhalt' },
  SH: { de: 'Schleswig-Holstein', en: 'Schleswig-Holstein' },
  TH: { de: 'Thüringen', en: 'Thuringia' },
};

/** Name of a country code, or the code itself if it is not in the list. */
export function countryName(code: string, language: SupportedLanguage): string {
  const upper = code.toUpperCase();
  return COUNTRIES[upper]?.[language] ?? upper;
}

/** "Deutschland, Bayern (DE BY 123 EG)", or only the code if it names no country. */
export function describePackagerCode(code: PackagerCode, language: SupportedLanguage): string {
  if (!code.country) return code.formatted;
  const place = [
    countryName(code.country, language),
    code.region ? GERMAN_STATE_NAMES[code.region][language] : undefined,
  ]
    .filter(Boolean)
    .join(', ');
  return `${place} (${code.formatted})`;
}
