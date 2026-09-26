/** Raised when a request does not complete in time or the network is unreachable. */
export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly reason: 'timeout' | 'unreachable' | 'cancelled'
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export const DEFAULT_TIMEOUT_MS = 8000;

/**
 * fetch with a hard timeout. Weak in-store reception must not leave the user
 * waiting indefinitely; callers fall back to cached data instead. A `signal` in
 * `init` cancels the request early (reason 'cancelled').
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const external = init.signal;
  const cancel = () => controller.abort();
  if (external?.aborted) controller.abort();
  else external?.addEventListener('abort', cancel);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (external?.aborted) throw new NetworkError('Request was cancelled', 'cancelled');
    if (controller.signal.aborted) {
      throw new NetworkError(`Request timed out after ${timeoutMs} ms`, 'timeout');
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new NetworkError(`Network request failed: ${detail}`, 'unreachable');
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', cancel);
  }
}
