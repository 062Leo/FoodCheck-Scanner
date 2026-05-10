import { apiGet, apiPost } from '../baseClient';
import { ApiError } from '../ApiError';

// Mock fetch globally
global.fetch = jest.fn();

// Mock config so staging auth is NOT active during tests
jest.mock('../config', () => ({
  ...jest.requireActual('../config'),
  USE_STAGING: false,
  BASE_URL: 'https://world.openfoodfacts.org',
  USER_AGENT: 'TrueFoodScanner/1.0 (test@example.com)',
}));

describe('apiGet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should attach User-Agent header', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 1, product: {} }),
    });

    await apiGet('/api/v2/product/123.json');

    expect(fetch).toHaveBeenCalledWith(
      'https://world.openfoodfacts.org/api/v2/product/123.json',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'User-Agent': 'TrueFoodScanner/1.0 (test@example.com)',
        }),
      })
    );
  });

  it('should merge extra headers', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 1 }),
    });

    await apiGet('/api/v2/product/123.json', {
      headers: { 'X-Custom': 'value' },
    });

    const headers = (fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers['User-Agent']).toBe('TrueFoodScanner/1.0 (test@example.com)');
    expect(headers['X-Custom']).toBe('value');
  });

  it('should return status and parsed body', async () => {
    const mockBody = { status: 1, product: { product_name: 'Test' } };
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockBody,
    });

    const result = await apiGet('/api/v2/product/123.json');

    expect(result.status).toBe(200);
    expect(result.body).toEqual(mockBody);
  });

  it('should throw ApiError on non-ok response', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(apiGet('/api/v2/product/123.json')).rejects.toThrow(ApiError);
  });
});

describe('apiPost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should POST with FormData and User-Agent', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => '1',
    });

    const formData = new FormData();
    formData.append('code', '123');

    await apiPost('/cgi/product_jqm2.pl', formData);

    expect(fetch).toHaveBeenCalledWith(
      'https://world.openfoodfacts.org/cgi/product_jqm2.pl',
      expect.objectContaining({
        method: 'POST',
        body: formData,
        headers: expect.objectContaining({
          'User-Agent': 'TrueFoodScanner/1.0 (test@example.com)',
        }),
      })
    );
  });

  it('should throw ApiError on non-ok response', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const formData = new FormData();

    await expect(apiPost('/cgi/product_jqm2.pl', formData)).rejects.toThrow(ApiError);
  });

  it('should return text response body', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => '{"status":1}',
    });

    const formData = new FormData();
    const result = await apiPost('/cgi/product_jqm2.pl', formData);

    expect(result.text).toBe('{"status":1}');
  });
});
