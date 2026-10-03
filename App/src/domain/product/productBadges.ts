import type { Product } from '../../types/Product';
import { mentionsRawMilk } from './rawMilk';

/**
 * Badges for labels on the product page (organic, GMO, animal welfare, fishing, raw
 * milk). Display only: nothing here feeds into the rating.
 *
 * Tag names follow the Open Food Facts labels taxonomy. Open Food Facts adds the parent
 * labels to `labels_tags` (a Demeter product also carries "en:organic"), so the parents
 * alone would mostly do; the children are listed for data edited on the device.
 */
export type BadgeTone = 'positive' | 'neutral' | 'warning' | 'info';

export type HusbandryLevel = 1 | 2 | 3 | 4 | 5;

/** Organic associations shown by name next to the organic badge. */
export type OrganicAssociation = 'Demeter' | 'Bioland' | 'Naturland';

export type ProductBadge =
  | { kind: 'organic'; tone: 'positive'; associations: OrganicAssociation[] }
  | { kind: 'noGmo'; tone: 'positive' }
  | { kind: 'containsGmo'; tone: 'warning' }
  | { kind: 'husbandry'; tone: BadgeTone; level: HusbandryLevel }
  | { kind: 'freeRange'; tone: 'positive' }
  | { kind: 'msc'; tone: 'info' }
  | { kind: 'asc'; tone: 'info' }
  | { kind: 'rawMilk'; tone: 'positive' };

const ORGANIC_TAGS = new Set([
  'en:organic',
  'en:eu-organic',
  'en:biodynamic-agriculture',
  'en:demeter',
  'en:bioland',
  'en:naturland',
  'en:naturland-fair',
]);
/** National organic control body codes, e.g. "en:de-oko-001", "en:es-eco-002-an". */
const ORGANIC_CODE =
  /^[a-z]{2}:[a-z]{2}-(bio|oko|oeko|öko|øko|eko|eco|ekol|org|ecol)-\d{2,3}(-[a-z]+)?$/;

const ASSOCIATIONS: { name: OrganicAssociation; tags: string[] }[] = [
  { name: 'Demeter', tags: ['en:demeter'] },
  { name: 'Bioland', tags: ['en:bioland'] },
  { name: 'Naturland', tags: ['en:naturland', 'en:naturland-fair'] },
];

const NO_GMO_TAGS = new Set([
  'en:no-gmos',
  'de:ohne-gentechnik',
  'de:ohne-gentechnik-hergestellt',
  'en:non-gmo-project',
  'en:no-gmo-soy',
  'en:french-soy-without-gmos',
  'en:fed-without-gmos',
  'en:eggs-from-animals-fed-without-gmos',
]);

const CONTAINS_GMO_TAG = 'en:contains-gmos';

const HUSBANDRY_TAGS: Record<string, HusbandryLevel> = {
  'de:haltungsform-1-stall': 1,
  'de:haltungsform-2-stall-platz': 2,
  'de:haltungsform-3-frischluftklima': 3,
  'de:haltungsform-4-auslauf-weide': 4,
  'de:haltungsform-5-bio': 5,
};

const FREE_RANGE_TAGS = new Set([
  'en:free-range',
  'en:free-range-eggs',
  'en:made-with-free-range-eggs',
  'en:free-range-pork',
  'en:free-range-poultry',
  'en:free-range-chicken',
  'en:from-free-range-chickens',
  'fr:cultive-en-plein-air',
  'fr:porc-eleve-sur-paille-ou-en-plein-air',
  'fr:porc-fermier-eleve-en-plein-air',
  'fr:volailles-fermieres-de-loue-elevees-en-liberte',
]);

const MSC_TAG = 'en:sustainable-seafood-msc';
const ASC_TAG = 'en:responsible-aquaculture-asc';

/** Categories for unpasteurised products, e.g. "en:raw-milks", "en:unpasteurised-cheeses". */
const RAW_MILK_CATEGORIES = new Set([
  'en:unpasteurised-products',
  'en:unpasteurised-cheeses',
  'en:raw-milks',
]);

function husbandryTone(level: HusbandryLevel): BadgeTone {
  if (level <= 2) return 'warning';
  return level === 3 ? 'neutral' : 'positive';
}

/** Badges in a fixed order: organic, GMO, animal welfare, fishing, raw milk. */
export function productBadges(product: Product): ProductBadge[] {
  const labels = new Set(product.labelsTags ?? []);
  const has = (tags: Iterable<string>) => [...tags].some((tag) => labels.has(tag));
  const badges: ProductBadge[] = [];

  if (has(ORGANIC_TAGS) || [...labels].some((tag) => ORGANIC_CODE.test(tag))) {
    badges.push({
      kind: 'organic',
      tone: 'positive',
      associations: ASSOCIATIONS.filter(({ tags }) => has(tags)).map(({ name }) => name),
    });
  }

  if (has(NO_GMO_TAGS)) badges.push({ kind: 'noGmo', tone: 'positive' });
  if (labels.has(CONTAINS_GMO_TAG)) badges.push({ kind: 'containsGmo', tone: 'warning' });

  const levels = [
    ...new Set(
      [...labels]
        .map((tag) => HUSBANDRY_TAGS[tag])
        .filter((level): level is HusbandryLevel => level !== undefined)
    ),
  ].sort((a, b) => a - b);
  for (const level of levels) {
    badges.push({ kind: 'husbandry', tone: husbandryTone(level), level });
  }

  if (has(FREE_RANGE_TAGS)) badges.push({ kind: 'freeRange', tone: 'positive' });
  if (labels.has(MSC_TAG)) badges.push({ kind: 'msc', tone: 'info' });
  if (labels.has(ASC_TAG)) badges.push({ kind: 'asc', tone: 'info' });

  const rawMilk =
    (product.categoriesTags ?? []).some((tag) => RAW_MILK_CATEGORIES.has(tag)) ||
    mentionsRawMilk(product.ingredientsText);
  if (rawMilk) badges.push({ kind: 'rawMilk', tone: 'positive' });

  return badges;
}
