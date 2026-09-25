import { fetchWithTimeout, NetworkError } from '../fetchWithTimeout';

describe('fetchWithTimeout', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('aborts a hanging request after the timeout', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (_url: unknown, init?: { signal?: AbortSignal | null }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );

    const request = fetchWithTimeout('https://example.test', {}, 5000);
    jest.advanceTimersByTime(5000);

    await expect(request).rejects.toEqual(expect.any(NetworkError));
    await expect(request).rejects.toMatchObject({ reason: 'timeout' });
  });

  it('reports an unreachable network', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(fetchWithTimeout('https://example.test')).rejects.toMatchObject({
      name: 'NetworkError',
      reason: 'unreachable',
    });
  });

  it('passes successful responses through', async () => {
    const response = { ok: true, status: 200 };
    global.fetch = jest.fn().mockResolvedValue(response);

    await expect(fetchWithTimeout('https://example.test')).resolves.toBe(response);
  });
});
