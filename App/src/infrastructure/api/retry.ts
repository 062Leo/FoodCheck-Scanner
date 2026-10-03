import { ApiError } from './ApiError';

export interface RetryOptions {
  /** Additional attempts after the first one. */
  retries?: number;
  baseDelayMs?: number;
}

const DEFAULT_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries retryable ApiErrors (429/503) with exponential backoff. */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (error instanceof ApiError && error.retryable && attempt < retries) {
        await delay(baseDelayMs * Math.pow(2, attempt));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}
