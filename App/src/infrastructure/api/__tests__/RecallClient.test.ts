import {
  fetchRecalls,
  parseRssDate,
  parseRssFeed,
  RECALL_RSS_URL,
  RecallSourceError,
} from '../RecallClient';

const ITEM = `<item>
<title>Beispiel Nudeln &amp; Sauce, 500 Gramm</title>
<link>https://www.lebensmittelwarnung.de/meldung/beispiel.html</link>
<pubDate>Fri, 2 Oct 2026 16:52:00 +0200</pubDate>
<description><![CDATA[<img src="https://www.lebensmittelwarnung.de/bild.png?a=1&amp;v=3" width="100" /><br/><b>Bildquelle</b> © Beispielfirma<br/><b>Chargennummer / Los-Kennzeichnung:</b> EAN-Code: 4006381333931, Los L123<br/><b>Kontakt:</b> Kundenservice der Beispielfirma<br/><b>Grund der Meldung:</b>   Fremdkörper<br/><b>Hersteller / Inverkehrbringer:</b> Beispielfirma GmbH,
Musterweg 1<br/><b>Produktbezeichnung/ -beschreibung:</b> Nudeln mit Sauce, Marke: Beispielmarke, 500 Gramm<br/><b>Betroffene Bundesländer nach derzeitigem Stand:</b>   Bayern, Berlin, Bayern<br/>]]></description>
<guid>https://www.lebensmittelwarnung.de/meldung/beispiel.html</guid>
</item>`;

const FEED = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Feed</title>${ITEM}</channel></rss>`;

function response(body: string, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, text: async () => body } as Response;
}

describe('parseRssFeed', () => {
  it('reads title, product, brand, reason, date, link, image, states and barcodes', () => {
    const [recall] = parseRssFeed(FEED);

    expect(recall).toEqual({
      id: 'rss:https://www.lebensmittelwarnung.de/meldung/beispiel.html',
      title: 'Beispiel Nudeln & Sauce, 500 Gramm',
      productName: 'Nudeln mit Sauce, Marke: Beispielmarke, 500 Gramm',
      brand: 'Beispielmarke',
      manufacturer: 'Beispielfirma GmbH',
      reason: 'Fremdkörper',
      publishedAt: Date.UTC(2026, 9, 2, 14, 52),
      link: 'https://www.lebensmittelwarnung.de/meldung/beispiel.html',
      imageUrl: 'https://www.lebensmittelwarnung.de/bild.png?a=1&v=3',
      states: ['Bayern', 'Berlin'],
      eans: ['4006381333931'],
    });
  });

  it('rejects documents that are no RSS feed', () => {
    expect(() => parseRssFeed('<html><body>Wartung</body></html>')).toThrow(RecallSourceError);
  });

  it('rejects a feed whose items cannot be read', () => {
    const broken = '<rss><channel><item><foo>bar</foo></item></channel></rss>';
    expect(() => parseRssFeed(broken)).toThrow(expect.objectContaining({ kind: 'shape' }));
  });

  it('accepts an empty feed', () => {
    expect(parseRssFeed('<rss version="2.0"><channel></channel></rss>')).toEqual([]);
  });
});

describe('parseRssDate', () => {
  it('applies the time zone', () => {
    expect(parseRssDate('Tue, 6 Jun 2023 00:00:00 +0200')).toBe(Date.UTC(2023, 5, 5, 22));
    expect(parseRssDate('Tue, 6 Jun 2023 00:00:00 GMT')).toBe(Date.UTC(2023, 5, 6));
    expect(parseRssDate('gestern')).toBeNull();
  });
});

describe('fetchRecalls', () => {
  const fetchMock = jest.fn();
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('reads the official RSS feed', async () => {
    fetchMock.mockResolvedValue(response(FEED));

    const recalls = await fetchRecalls();

    expect(recalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(RECALL_RSS_URL);
    expect(init.method).toBeUndefined();
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('reports a shape error for an unknown form and a failure otherwise', async () => {
    fetchMock.mockResolvedValueOnce(response('<html/>'));
    await expect(fetchRecalls()).rejects.toMatchObject({ kind: 'shape' });

    fetchMock.mockResolvedValueOnce(response('', 503));
    await expect(fetchRecalls()).rejects.toMatchObject({ kind: 'failure' });

    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(fetchRecalls()).rejects.toMatchObject({ kind: 'failure' });
  });
});
