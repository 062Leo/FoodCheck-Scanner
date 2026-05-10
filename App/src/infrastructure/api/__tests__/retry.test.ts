import { retryWithBackoff } from '../retry';
import { ApiError } from '../ApiError';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return result on first success without retrying', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const promise = retryWithBackoff(fn);

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on 429 and succeed on second attempt', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(ApiError.fromHttpStatus(429))
      .mockResolvedValueOnce('ok');

    const promise = retryWithBackoff(fn);

    // Allow first rejection to be processed
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance past 2000ms delay
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    await Promise.resolve();

    expect(fn).toHaveBeenCalledTimes(2);
    await expect(promise).resolves.toBe('ok');
  });

  it('should retry on 503 and succeed on third attempt', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(ApiError.fromHttpStatus(503))
      .mockRejectedValueOnce(ApiError.fromHttpStatus(503))
      .mockResolvedValueOnce('ok');

    const promise = retryWithBackoff(fn);

    await Promise.resolve();
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    await Promise.resolve();

    jest.advanceTimersByTime(4000);
    await Promise.resolve();
    await Promise.resolve();

    expect(fn).toHaveBeenCalledTimes(3);
    await expect(promise).resolves.toBe('ok');
  });

  it('should give up after 4 total attempts and throw last error', async () => {
    const lastErr = ApiError.fromHttpStatus(429, 'rate limited');
    const fn = jest
      .fn()
      .mockRejectedValueOnce(ApiError.fromHttpStatus(429, 'r1'))
      .mockRejectedValueOnce(ApiError.fromHttpStatus(429, 'r2'))
      .mockRejectedValueOnce(ApiError.fromHttpStatus(429, 'r3'))
      .mockRejectedValueOnce(lastErr);

    const promise = retryWithBackoff(fn);

    await Promise.resolve();
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    await Promise.resolve();

    jest.advanceTimersByTime(4000);
    await Promise.resolve();
    await Promise.resolve();

    jest.advanceTimersByTime(8000);
    await Promise.resolve();
    await Promise.resolve();

    expect(fn).toHaveBeenCalledTimes(4);
    await expect(promise).rejects.toThrow(lastErr);
  });

  it('should NOT retry on 400 (non-retryable)', async () => {
    const err = ApiError.fromHttpStatus(400);
    const fn = jest.fn().mockRejectedValue(err);

    const promise = retryWithBackoff(fn);
    await Promise.resolve();

    await expect(promise).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should NOT retry on 403 (non-retryable)', async () => {
    const err = ApiError.fromHttpStatus(403);
    const fn = jest.fn().mockRejectedValue(err);

    const promise = retryWithBackoff(fn);
    await Promise.resolve();

    await expect(promise).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should NOT retry on 404 (non-retryable)', async () => {
    const err = ApiError.fromHttpStatus(404);
    const fn = jest.fn().mockRejectedValue(err);

    const promise = retryWithBackoff(fn);
    await Promise.resolve();

    await expect(promise).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should NOT retry on non-ApiError exceptions', async () => {
    const err = new Error('network down');
    const fn = jest.fn().mockRejectedValue(err);

    const promise = retryWithBackoff(fn);
    await Promise.resolve();

    await expect(promise).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
