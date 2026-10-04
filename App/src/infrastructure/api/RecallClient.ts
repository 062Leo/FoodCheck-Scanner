import { decodeEntities, extractEans, plainText, type Recall } from '../../domain/recalls/recall';
import { USER_AGENT } from './config';
import { fetchWithTimeout, NetworkError } from './fetchWithTimeout';

/** Official RSS feed of lebensmittelwarnung.de, food warnings of all federal states. */
export const RECALL_RSS_URL =
  'https://www.lebensmittelwarnung.de/___LMW-Redaktion/RSSNewsfeed/Functions/RssFeeds/rssnewsfeed_Alle_DE.xml?nn=314268&type=lebensmittel';

const TIMEOUT_MS = 15000;

/**
 * 'shape': the source answered, but not in the expected form (it changed or was switched off).
 * 'failure': network error, timeout or HTTP error.
 */
export type RecallSourceErrorKind = 'shape' | 'failure';

export class RecallSourceError extends Error {
  constructor(
    public readonly kind: RecallSourceErrorKind,
    message: string
  ) {
    super(message);
    this.name = 'RecallSourceError';
  }
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = plainText(value);
  return cleaned.length > 0 ? cleaned : null;
}

function httpsUrl(value: unknown): string | null {
  return typeof value === 'string' && /^https:\/\/\S+$/.test(value.trim()) ? value.trim() : null;
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** RFC 822 date of RSS ("Fri, 2 Oct 2026 16:52:00 +0200"); parsed by hand for Hermes. */
export function parseRssDate(value: string): number | null {
  const match =
    /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4}|GMT|UTC|Z)?/.exec(
      value
    );
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (month === undefined) return null;
  const utc = Date.UTC(
    Number(match[3]),
    month,
    Number(match[1]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0)
  );
  const zone = match[7];
  if (!zone || !/^[+-]/.test(zone)) return utc;
  const sign = zone.startsWith('-') ? -1 : 1;
  const offsetMinutes = Number(zone.slice(1, 3)) * 60 + Number(zone.slice(3, 5));
  return utc - sign * offsetMinutes * 60 * 1000;
}

function unwrapCdata(value: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(value);
  return cdata ? cdata[1] : value;
}

function tag(item: string, name: string): string | null {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(item);
  return match ? unwrapCdata(match[1]).trim() : null;
}

/** The "<b>Label:</b> value" fields of a feed item's description. */
function descriptionFields(html: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const match of html.matchAll(/<b>\s*([^<]+?)\s*:?\s*<\/b>([\s\S]*?)(?=<b>|$)/g)) {
    const label = match[1].replace(/:$/, '').trim();
    if (!fields.has(label)) fields.set(label, match[2]);
  }
  return fields;
}

/** First line of the manufacturer field; the rest is a postal address. */
function firstPart(value: string | null): string | null {
  if (!value) return null;
  const part = value.split(/,|\n/)[0].trim();
  return part.length > 0 ? part : null;
}

function parseRssItem(item: string): Recall | null {
  const title = text(decodeEntities(tag(item, 'title') ?? ''));
  const link = httpsUrl(decodeEntities(tag(item, 'link') ?? ''));
  const publishedAt = parseRssDate(tag(item, 'pubDate') ?? '');
  if (!title || !link || publishedAt === null) return null;

  const description = tag(item, 'description') ?? '';
  const fields = descriptionFields(description);
  const field = (label: string) => {
    const value = fields.get(label);
    return value === undefined ? null : text(value);
  };
  const productName = field('Produktbezeichnung/ -beschreibung');
  const brand = productName ? (/Marke:\s*([^,;]+)/.exec(productName)?.[1].trim() ?? null) : null;
  const manufacturerRaw = fields.get('Hersteller / Inverkehrbringer');
  const image = /<img[^>]+src="([^"]+)"/.exec(description)?.[1];

  return {
    id: `rss:${link}`,
    title,
    productName,
    brand,
    manufacturer: firstPart(
      manufacturerRaw ? decodeEntities(manufacturerRaw.replace(/<[^>]*>/g, '')) : null
    ),
    reason: field('Grund der Meldung'),
    publishedAt,
    link,
    imageUrl: image ? httpsUrl(decodeEntities(image)) : null,
    states: [
      ...new Set(
        (field('Betroffene Bundesländer nach derzeitigem Stand') ?? '')
          .split(',')
          .map((state) => state.trim())
          .filter(Boolean)
      ),
    ],
    eans: extractEans(
      [title, productName, field('Chargennummer / Los-Kennzeichnung')].filter(Boolean).join(' ')
    ),
  };
}

/** The official RSS feed; throws 'shape' when it is no RSS feed or its items are unreadable. */
export function parseRssFeed(xml: string): Recall[] {
  if (!/<rss[\s>]/.test(xml) || !/<channel[\s>]/.test(xml)) {
    throw new RecallSourceError('shape', 'Recall feed is not an RSS feed');
  }
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const recalls = items.map(parseRssItem).filter((recall): recall is Recall => !!recall);
  if (items.length > 0 && recalls.length === 0) {
    throw new RecallSourceError('shape', 'Recall feed items have an unknown form');
  }
  return recalls;
}

async function request(url: string, init: RequestInit): Promise<string> {
  let response: Response;
  try {
    response = await fetchWithTimeout(url, init, TIMEOUT_MS);
  } catch (error) {
    const detail = error instanceof NetworkError ? error.reason : 'network';
    throw new RecallSourceError('failure', `Recall request failed: ${detail}`);
  }
  if (!response.ok) {
    throw new RecallSourceError('failure', `Recall request failed: HTTP ${response.status}`);
  }
  try {
    return await response.text();
  } catch {
    throw new RecallSourceError('failure', 'Recall response could not be read');
  }
}

export async function fetchFromRss(): Promise<Recall[]> {
  const body = await request(RECALL_RSS_URL, {
    headers: { Accept: 'application/rss+xml, application/xml', 'User-Agent': USER_AGENT },
  });
  return parseRssFeed(body);
}

/**
 * Current warnings from the official RSS feed, newest first. Throws a RecallSourceError:
 * 'shape' when the feed answered in an unexpected form, 'failure' otherwise.
 */
export async function fetchRecalls(): Promise<Recall[]> {
  const recalls = await fetchFromRss();
  return [...recalls].sort((a, b) => b.publishedAt - a.publishedAt);
}
