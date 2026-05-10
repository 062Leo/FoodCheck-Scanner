export class ApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly statusVerbose?: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromHttpStatus(status: number, statusVerbose?: string): ApiError {
    const retryable = status === 429 || status === 503;
    const message = statusVerbose ?? `HTTP ${status}`;
    return new ApiError(message, status, statusVerbose, retryable);
  }
}

export class ProductNotFoundError extends ApiError {
  constructor(barcode: string) {
    super(`Product not found: ${barcode}`, 404, 'product not found', false);
    this.name = 'ProductNotFoundError';
  }
}
