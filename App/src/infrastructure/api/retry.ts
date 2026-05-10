import { ApiError } from './ApiError';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (error instanceof ApiError && error.retryable && attempt < MAX_RETRIES) {
        const waitMs = BASE_DELAY_MS * Math.pow(2, attempt);
        await delay(waitMs);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}
