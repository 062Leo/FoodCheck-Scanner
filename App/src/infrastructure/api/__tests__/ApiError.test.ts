import { ApiError, ProductNotFoundError } from '../ApiError';

describe('ApiError', () => {
  it('should set name to ApiError', () => {
    const err = new ApiError('test', 500);
    expect(err.name).toBe('ApiError');
  });

  it('should store httpStatus and statusVerbose', () => {
    const err = new ApiError('not found', 404, 'product not found');
    expect(err.httpStatus).toBe(404);
    expect(err.statusVerbose).toBe('product not found');
    expect(err.message).toBe('not found');
  });

  describe('fromHttpStatus', () => {
    it('should mark 429 as retryable', () => {
      const err = ApiError.fromHttpStatus(429);
      expect(err.retryable).toBe(true);
      expect(err.httpStatus).toBe(429);
    });

    it('should mark 503 as retryable', () => {
      const err = ApiError.fromHttpStatus(503);
      expect(err.retryable).toBe(true);
    });

    it('should mark 400 as non-retryable', () => {
      const err = ApiError.fromHttpStatus(400);
      expect(err.retryable).toBe(false);
    });

    it('should mark 403 as non-retryable', () => {
      const err = ApiError.fromHttpStatus(403);
      expect(err.retryable).toBe(false);
    });

    it('should mark 404 as non-retryable', () => {
      const err = ApiError.fromHttpStatus(404);
      expect(err.retryable).toBe(false);
    });

    it('should mark 500 as non-retryable', () => {
      const err = ApiError.fromHttpStatus(500);
      expect(err.retryable).toBe(false);
    });

    it('should use statusVerbose in message when provided', () => {
      const err = ApiError.fromHttpStatus(429, 'Too Many Requests');
      expect(err.message).toBe('Too Many Requests');
    });
  });
});

describe('ProductNotFoundError', () => {
  it('should extend ApiError and set 404 not found', () => {
    const err = new ProductNotFoundError('1234567890123');
    expect(err).toBeInstanceOf(ApiError);
    expect(err.httpStatus).toBe(404);
    expect(err.retryable).toBe(false);
    expect(err.message).toContain('1234567890123');
  });
});
