import {
  collectCompanyNames,
  CompanyLookupError,
  isUsableName,
  MAX_PARENTS_PER_QUERY,
  searchCompanies,
} from '../CompanyLookupService';

const fetchMock = jest.fn();
global.fetch = fetchMock;

const ENTITY = 'http://www.wikidata.org/entity/';

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: async () => body });
}

function sparqlQuery(url: string): string {
  return decodeURIComponent(new URL(url).searchParams.get('query') ?? '');
}

/** The items in the query's first VALUES block. */
function parentsOf(query: string): string[] {
  const values = /VALUES \?\w+ \{([^}]*)\}/.exec(query)?.[1] ?? '';
  return values
    .trim()
    .split(/\s+/)
    .map((id) => id.replace('wd:', ''));
}

function rows(items: [string, string | null][]) {
  return {
    results: {
      bindings: items.map(([id, label]) => ({
        child: { value: `${ENTITY}${id}` },
        item: { value: `${ENTITY}${id}` },
        ...(label ? { label: { value: label } } : {}),
      })),
    },
  };
}

/**
 * A small company tree: root Q1 with labels, children per parent. Q3 points back to Q1
 * (a cycle) and Q4 has no label.
 */
const TREE: Record<string, [string, string | null][]> = {
  Q1: [
    ['Q2', 'Maggi'],
    ['Q3', 'Thomy'],
    ['Q4', null],
  ],
  Q2: [['Q5', 'Maggi Fix']],
  Q3: [['Q1', 'Nestlé']],
  Q4: [['Q6', 'Wagner']],
  Q5: [['Q7', 'Level four']],
};

function serveTree(url: string) {
  const query = sparqlQuery(url);
  const parents = parentsOf(query);
  if (query.includes('SELECT ?item ?label')) {
    return ok(
      rows([
        ['Q1', 'Nestlé'],
        ['Q1', 'Nestle'],
      ])
    );
  }
  return ok(rows(parents.flatMap((parent) => TREE[parent] ?? [])));
}

describe('CompanyLookupService', () => {
  beforeEach(() => fetchMock.mockReset());

  describe('searchCompanies', () => {
    it('returns the candidates with label and description', async () => {
      fetchMock.mockReturnValue(
        ok({
          search: [
            { id: 'Q160746', label: 'Nestlé', description: 'Schweizer Lebensmittelkonzern' },
            { id: 'Q37485297', label: 'Nestle' },
            { label: 'without id' },
          ],
        })
      );

      await expect(searchCompanies('Nestlé', 'de')).resolves.toEqual([
        { id: 'Q160746', label: 'Nestlé', description: 'Schweizer Lebensmittelkonzern' },
        { id: 'Q37485297', label: 'Nestle' },
      ]);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('action=wbsearchentities');
      expect(url).toContain('search=Nestl%C3%A9');
      expect(url).toContain('language=de&uselang=de');
      expect(url).toContain('origin=*');
      expect(init.headers['User-Agent']).toBe(
        'FoodCheck/1.0 (https://github.com/062Leo/FoodCheck-Scanner)'
      );
    });

    it('does not ask for an empty name', async () => {
      await expect(searchCompanies('  ', 'de')).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws a typed error on HTTP errors, bad data and missing connection', async () => {
      fetchMock.mockReturnValueOnce(Promise.resolve({ ok: false, status: 503 }));
      await expect(searchCompanies('Nestlé', 'de')).rejects.toMatchObject({
        name: 'CompanyLookupError',
        reason: 'server',
      });

      fetchMock.mockReturnValueOnce(ok({ error: 'nope' }));
      await expect(searchCompanies('Nestlé', 'de')).rejects.toMatchObject({ reason: 'format' });

      fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
      const offline = searchCompanies('Nestlé', 'de');
      await expect(offline).rejects.toBeInstanceOf(CompanyLookupError);
      await expect(offline).rejects.toMatchObject({ reason: 'network' });
    });

    it('gives up after the timeout', async () => {
      jest.useFakeTimers();
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
          )
      );

      const search = searchCompanies('Nestlé', 'de');
      const result = expect(search).rejects.toMatchObject({ reason: 'timeout' });
      await jest.advanceTimersByTimeAsync(15_000);
      await result;
      jest.useRealTimers();
    });
  });

  describe('collectCompanyNames', () => {
    it('collects three levels breadth first and stops at cycles', async () => {
      fetchMock.mockImplementation(serveTree);

      const data = await collectCompanyNames('Q1');

      expect(data).toEqual({
        wikidataId: 'Q1',
        names: ['Nestlé', 'Nestle', 'Maggi', 'Thomy', 'Maggi Fix', 'Wagner', 'Level four'],
      });
      const childQueries = fetchMock.mock.calls
        .map(([url]) => sparqlQuery(url))
        .filter((query) => query.includes('?child'));
      expect(childQueries.map(parentsOf)).toEqual([['Q1'], ['Q2', 'Q3', 'Q4'], ['Q5', 'Q6']]);
    });

    it('only follows current majority statements', async () => {
      fetchMock.mockImplementation(serveTree);

      await collectCompanyNames('Q1');

      const query = sparqlQuery(fetchMock.mock.calls[1][0]);
      expect(query).toContain('p:P749');
      expect(query).toContain('p:P127');
      expect(query).toContain('p:P176');
      expect(query).toContain('FILTER NOT EXISTS { ?statement pq:P582 ?end . }');
      expect(query).toContain('FILTER(?share < 0.5)');
      expect(query).toContain('wikibase:DeprecatedRank');
      expect(fetchMock.mock.calls[1][0]).toMatch(/^https:\/\/query\.wikidata\.org\/sparql\?/);
      expect(fetchMock.mock.calls[1][1].headers['User-Agent']).toBe(
        'FoodCheck/1.0 (https://github.com/062Leo/FoodCheck-Scanner)'
      );
    });

    it('splits long parent lists into several queries', async () => {
      const many = Array.from(
        { length: MAX_PARENTS_PER_QUERY + 5 },
        (_, i) => [`Q${1000 + i}`, null] as [string, null]
      );
      fetchMock.mockImplementation((url: string) => {
        const query = sparqlQuery(url);
        if (query.includes('SELECT ?item ?label')) return ok(rows([['Q1', 'Root']]));
        return ok(rows(parentsOf(query).includes('Q1') ? many : []));
      });

      await collectCompanyNames('Q1');

      const secondLevel = fetchMock.mock.calls
        .map(([url]) => parentsOf(sparqlQuery(url)))
        .filter((parents) => parents[0] !== 'Q1');
      expect(secondLevel.map((parents) => parents.length)).toEqual([MAX_PARENTS_PER_QUERY, 5]);
    });

    it('drops long, wordy and unlabeled names and duplicates', async () => {
      fetchMock.mockImplementation((url: string) => {
        const query = sparqlQuery(url);
        if (query.includes('SELECT ?item ?label')) return ok(rows([['Q1', 'Nestlé']]));
        if (!parentsOf(query).includes('Q1')) return ok(rows([]));
        return ok(
          rows([
            ['Q2', 'KitKat'],
            ['Q3', 'KitKat '],
            ['Q4', 'Q4'],
            ['Q5', 'Process for producing a creamer with a long patent title'],
            ['Q6', 'One two three four five six'],
            ['Q7', 'NESTLÉ'],
          ])
        );
      });

      await expect(collectCompanyNames('Q1')).resolves.toEqual({
        wikidataId: 'Q1',
        names: ['Nestlé', 'KitKat'],
      });
      expect(isUsableName('Garden Gourmet')).toBe(true);
      expect(isUsableName('Q160746')).toBe(false);
    });

    it('rejects ids that are not Wikidata items', async () => {
      await expect(collectCompanyNames('Nestlé')).rejects.toMatchObject({ reason: 'format' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fails as a whole when a level cannot be loaded', async () => {
      fetchMock
        .mockImplementationOnce(serveTree)
        .mockReturnValueOnce(Promise.resolve({ ok: false, status: 429 }));

      await expect(collectCompanyNames('Q1')).rejects.toMatchObject({ reason: 'server' });
    });

    it('stops when cancelled', async () => {
      const controller = new AbortController();
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
          )
      );

      const collecting = collectCompanyNames('Q1', { signal: controller.signal });
      controller.abort();

      await expect(collecting).rejects.toMatchObject({ reason: 'cancelled' });
    });
  });
});
