import { BASE_URL, USER_AGENT, STAGING_AUTH, USE_STAGING } from './config';
import { ApiError } from './ApiError';
import { retryWithBackoff } from './retry';

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    ...extra,
  };

  if (USE_STAGING) {
    headers['Authorization'] = STAGING_AUTH;
  }

  return headers;
}

export async function apiGet<T = unknown>(
  path: string,
  options?: { headers?: Record<string, string> }
): Promise<{ status: number; body: T }> {
  return retryWithBackoff(async () => {
    const url = `${BASE_URL}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(options?.headers),
    });

    if (!response.ok) {
      throw ApiError.fromHttpStatus(response.status);
    }

    const body = (await response.json()) as T;
    return { status: response.status, body };
  });
}

export async function apiPost(
  path: string,
  formData: FormData,
  options?: { headers?: Record<string, string> }
): Promise<{ status: number; text: string }> {
  return retryWithBackoff(async () => {
    const url = `${BASE_URL}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: buildHeaders(options?.headers),
    });

    if (!response.ok) {
      throw ApiError.fromHttpStatus(response.status);
    }

    const text = await response.text();
    return { status: response.status, text };
  });
}
