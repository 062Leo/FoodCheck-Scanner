jest.mock('../config', () => ({
  ...jest.requireActual('../config'),
  WRITE_ENV: 'staging',
  WRITE_BASE_URL: 'https://world.openfoodfacts.net',
  WRITE_IMAGES_URL: 'https://images.openfoodfacts.net',
}));

import { OffOcrClient, OffOcrError, barcodePath } from '../OffOcrClient';

const fetchMock = jest.fn();
global.fetch = fetchMock;

describe('barcodePath', () => {
  it('splits EAN-13 codes and keeps short codes whole', () => {
    expect(barcodePath('3017624010701')).toBe('301/762/401/0701');
    expect(barcodePath('96385074')).toBe('96385074');
  });
});

describe('OffOcrClient', () => {
  const credentials = { loadCredentials: jest.fn() };
  const client = new OffOcrClient(credentials as never);

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockReset();
    credentials.loadCredentials.mockResolvedValue({ username: 'u', password: 'p' });
  });

  afterEach(() => jest.useRealTimers());

  it('uploads to the configured server with a language-specific image field', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'status ok', image: { imgid: 7 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ responses: [{ fullTextAnnotation: { text: 'Zucker, Salz' } }] }),
      });

    const promise = client.extractText('3017624010701', 'file:///photo.jpg', 'nutrition', 'de');
    await jest.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toBe('Zucker, Salz');
    const [uploadUrl, init] = fetchMock.mock.calls[0];
    expect(uploadUrl).toBe('https://world.openfoodfacts.net/cgi/product_image_upload.pl');
    expect((init.body as FormData).get('imagefield')).toBe('nutrition_de');
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://images.openfoodfacts.net/images/products/301/762/401/0701/7.json'
    );
  });

  it('does not upload without an account', async () => {
    credentials.loadCredentials.mockResolvedValue(null);

    await expect(
      client.extractText('3017624010701', 'file:///photo.jpg', 'ingredients', 'de')
    ).rejects.toEqual(expect.objectContaining({ code: 'no-credentials' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a failed upload', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'status not ok' }) });

    await expect(
      client.extractText('3017624010701', 'file:///photo.jpg', 'ingredients', 'de')
    ).rejects.toBeInstanceOf(OffOcrError);
  });
});
