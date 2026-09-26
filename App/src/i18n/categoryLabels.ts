import type { TranslationKey } from './translations';
import type { TranslateFn } from './useTranslation';

/**
 * Rule categories are stored as German strings (seed data and user rules), additive
 * function classes come from the taxonomy in German. This maps both to UI texts.
 */
export const CATEGORY_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  Süßungsmittel: 'filter.preset.sweeteners',
  Farbstoffe: 'filter.preset.colors',
  Konservierungsstoffe: 'filter.preset.preservatives',
  'Geschmacksverstärker & Aromen': 'filter.preset.flavorEnhancers',
  'Emulgatoren & Stabilisatoren': 'filter.preset.emulsifiers',
  'Verdickungs- & Geliermittel': 'filter.preset.thickeners',
  'Säuren & Säureregulatoren': 'filter.preset.acids',
  Antioxidationsmittel: 'filter.preset.antioxidants',
  'Gehärtete Fette & raffinierte Öle': 'filter.preset.hydrogenatedFats',
  'Zucker & Sirupe': 'filter.preset.sugarSyrups',
  'Modifizierte Stärken': 'filter.preset.modifiedStarches',
  'Phosphate & Mineralstoffe': 'filter.preset.phosphates',
  'Füll- & Trägerstoffe': 'filter.preset.fillers',
  'Proteine & Fleischersatz': 'filter.preset.proteins',
  'Trenn- & Überzugsmittel': 'filter.preset.releaseAgents',
  'Treib- & Schutzgase': 'filter.preset.propellantGases',
  Metalle: 'filter.preset.metals',
  'E-Nummern': 'filter.preset.eNumbers',
  'Sonstige Zusatzstoffe': 'filter.preset.other',
  'Kritische Öle': 'product.category.criticalOils',
  Zucker: 'product.category.sugar',
  Nährwerte: 'filter.defaultNutrientCategory',
  // Additive function classes (taxonomy)
  Farbstoff: 'filter.preset.colors',
  Konservierungsstoff: 'filter.preset.preservatives',
  'Konservierungs- und Antioxidationsmittel': 'filter.preset.preservatives',
  Säuerungsmittel: 'filter.preset.acids',
  Verdickungsmittel: 'filter.preset.thickeners',
  'Gelier- und Bindemittel': 'filter.preset.thickeners',
  Emulgator: 'filter.preset.emulsifiers',
  Stabilisator: 'filter.preset.emulsifiers',
  Geschmacksverstärker: 'filter.preset.flavorEnhancers',
  Zuckeraustauschstoff: 'filter.preset.sweeteners',
  Treibgas: 'filter.preset.propellantGases',
  Feuchthaltemittel: 'filter.preset.fillers',
  Füllstoff: 'filter.preset.fillers',
  Trennmittel: 'filter.preset.releaseAgents',
  Überzugsmittel: 'filter.preset.releaseAgents',
};

export function categoryLabel(category: string, t: TranslateFn): string {
  const key = CATEGORY_TRANSLATION_KEYS[category];
  return key ? t(key) : category;
}
