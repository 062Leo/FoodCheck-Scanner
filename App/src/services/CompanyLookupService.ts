import type { CompanyData } from '../domain/analysis/companyRules';
import { USER_AGENT } from '../infrastructure/api/config';
import { fetchWithTimeout, NetworkError } from '../infrastructure/api/fetchWithTimeout';
import { getErrorMessage } from '../shared/errors';

/**
 * Looks up a company at Wikidata (data under CC0) and collects the brands and companies
 * that belong to it, so an avoided company also matches products of its brands.
 */

const SEARCH_URL = 'https://www.wikidata.org/w/api.php';
const SPARQL_URL = 'https://query.wikidata.org/sparql';

export const LOOKUP_TIMEOUT_MS = 15000;
/** Levels below the company: brands and subsidiaries, theirs, and theirs again. */
export const MAX_LEVELS = 3;
/** Parent items per query; longer lists are split so the request URL stays short. */
export const MAX_PARENTS_PER_QUERY = 200;
export const MAX_NAMES = 1000;
const MAX_NAME_LENGTH = 40;
const MAX_NAME_WORDS = 5;

export type CompanyLookupFailure = 'network' | 'timeout' | 'cancelled' | 'server' | 'format';

/** A failed lookup; `reason` tells the UI what to show. */
export class CompanyLookupError extends Error {
  constructor(
    message: string,
    public readonly reason: CompanyLookupFailure
  ) {
    super(message);
    this.name = 'CompanyLookupError';
  }
}

export interface CompanyCandidate {
  /** Wikidata item, e.g. "Q160746". */
  id: string;
  label: string;
  description?: string;
}

interface LookupOptions {
  signal?: AbortSignal;
}

async function getJson(url: string, accept: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      { method: 'GET', headers: { 'User-Agent': USER_AGENT, Accept: accept }, signal },
      LOOKUP_TIMEOUT_MS
    );
  } catch (error) {
    if (error instanceof NetworkError) {
      const reason = error.reason === 'unreachable' ? 'network' : error.reason;
      throw new CompanyLookupError(error.message, reason);
    }
    throw new CompanyLookupError(getErrorMessage(error), 'network');
  }
  if (!response.ok) {
    throw new CompanyLookupError(`Wikidata returned HTTP ${response.status}`, 'server');
  }
  try {
    return await response.json();
  } catch (error) {
    throw new CompanyLookupError(`Invalid Wikidata response: ${getErrorMessage(error)}`, 'format');
  }
}

/** Wikidata items whose name matches `name`, for the user to pick the right one. */
export async function searchCompanies(
  name: string,
  lang: string,
  { signal }: LookupOptions = {}
): Promise<CompanyCandidate[]> {
  const query = name.trim();
  if (!query) return [];
  const params = [
    'action=wbsearchentities',
    `search=${encodeURIComponent(query)}`,
    `language=${encodeURIComponent(lang)}`,
    `uselang=${encodeURIComponent(lang)}`,
    'type=item',
    'limit=7',
    'format=json',
    'origin=*',
  ].join('&');
  const data = await getJson(`${SEARCH_URL}?${params}`, 'application/json', signal);
  const results = (data as { search?: unknown } | null)?.search;
  if (!Array.isArray(results)) {
    throw new CompanyLookupError('Wikidata search returned no result list', 'format');
  }
  return results.flatMap((entry: Record<string, unknown>) => {
    if (typeof entry?.id !== 'string') return [];
    const label = typeof entry.label === 'string' ? entry.label : entry.id;
    const description = typeof entry.description === 'string' ? entry.description : undefined;
    return [{ id: entry.id, label, ...(description ? { description } : {}) }];
  });
}

const QID = /^Q\d+$/;

interface SparqlBinding {
  [variable: string]: { value: string } | undefined;
}

async function runSparql(query: string, signal?: AbortSignal): Promise<SparqlBinding[]> {
  const url = `${SPARQL_URL}?format=json&query=${encodeURIComponent(query)}`;
  const data = await getJson(url, 'application/sparql-results+json', signal);
  const bindings = (data as { results?: { bindings?: unknown } } | null)?.results?.bindings;
  if (!Array.isArray(bindings)) {
    throw new CompanyLookupError('SPARQL response without results', 'format');
  }
  return bindings as SparqlBinding[];
}

function qidOf(uri: string | undefined): string | null {
  const id = uri?.slice(uri.lastIndexOf('/') + 1);
  return id && QID.test(id) ? id : null;
}

/** German and English labels of the given items (empty for items without one). */
function labelsQuery(ids: string[]): string {
  return `SELECT ?item ?label WHERE {
  VALUES ?item { ${ids.map((id) => `wd:${id}`).join(' ')} }
  ?item rdfs:label ?label .
  FILTER(LANG(?label) = "de" || LANG(?label) = "en")
}`;
}

/**
 * Items that currently belong to one of `parents`: parent organization (P749), owned by
 * (P127) or manufacturer (P176). Ended statements, minority stakes and deprecated
 * statements do not count, so a stake in another group does not pull in its brands.
 */
function childrenQuery(parents: string[]): string {
  return `SELECT DISTINCT ?child ?label WHERE {
  VALUES ?parent { ${parents.map((id) => `wd:${id}`).join(' ')} }
  { ?child p:P749 ?statement . ?statement ps:P749 ?parent . }
  UNION { ?child p:P127 ?statement . ?statement ps:P127 ?parent . }
  UNION { ?child p:P176 ?statement . ?statement ps:P176 ?parent . }
  ?statement wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  FILTER NOT EXISTS { ?statement pq:P582 ?end . }
  FILTER NOT EXISTS { ?statement pq:P1107 ?share . FILTER(?share < 0.5) }
  FILTER NOT EXISTS { ?child wdt:P31/wdt:P279* wd:Q253623 . }
  OPTIONAL { ?child rdfs:label ?label . FILTER(LANG(?label) = "de" || LANG(?label) = "en") }
}`;
}

/** True for a label that can be a brand name (not a patent title or an unlabeled item). */
export function isUsableName(label: string): boolean {
  const name = label.trim();
  if (!name || QID.test(name)) return false;
  if (name.length > MAX_NAME_LENGTH) return false;
  return name.split(/\s+/).length <= MAX_NAME_WORDS;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Collects the names of a company and of the brands and companies below it, level by
 * level (breadth first, at most MAX_LEVELS levels and MAX_NAMES names).
 */
export async function collectCompanyNames(
  qid: string,
  { signal }: LookupOptions = {}
): Promise<CompanyData> {
  if (!QID.test(qid)) throw new CompanyLookupError(`Not a Wikidata item: ${qid}`, 'format');

  const names: string[] = [];
  const seenNames = new Set<string>();
  const addName = (label: string | undefined) => {
    if (!label || names.length >= MAX_NAMES || !isUsableName(label)) return;
    const name = label.trim();
    const lower = name.toLowerCase();
    if (seenNames.has(lower)) return;
    seenNames.add(lower);
    names.push(name);
  };

  const rootLabels = await runSparql(labelsQuery([qid]), signal);
  rootLabels.forEach((row) => addName(row.label?.value));

  const visited = new Set([qid]);
  let parents = [qid];
  for (let level = 0; level < MAX_LEVELS && parents.length > 0; level++) {
    if (names.length >= MAX_NAMES) break;
    const next: string[] = [];
    const labels: string[] = [];
    for (const part of chunk(parents, MAX_PARENTS_PER_QUERY)) {
      for (const row of await runSparql(childrenQuery(part), signal)) {
        const child = qidOf(row.child?.value);
        if (!child) continue;
        if (!visited.has(child)) {
          visited.add(child);
          next.push(child);
        }
        if (row.label?.value) labels.push(row.label.value);
      }
    }
    // Sorted per level, so the closest brands come first and the result is stable.
    labels.sort((a, b) => a.localeCompare(b)).forEach(addName);
    parents = next;
  }

  return { wikidataId: qid, names };
}
