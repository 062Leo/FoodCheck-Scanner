import * as SecureStore from 'expo-secure-store';
import {
  APP_NAME,
  APP_VERSION,
  STAGING_AUTH,
  USER_AGENT,
  WRITE_BASE_URL,
  WRITE_ENV,
  generateAppUUID,
} from './config';
import { ApiError } from './ApiError';
import { retryWithBackoff } from './retry';
import { fetchWithTimeout } from './fetchWithTimeout';

const USERNAME_KEY = 'off_username';
const PASSWORD_KEY = 'off_password';
const WRITE_TIMEOUT_MS = 20000;

export type UploadErrorCode = 'no-credentials' | 'rejected' | 'network' | 'invalid-credentials';

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly code: UploadErrorCode = 'rejected',
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export interface OffCredentials {
  username: string;
  password: string;
}

function writeHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
  if (WRITE_ENV === 'staging') {
    headers['Authorization'] = STAGING_AUTH;
  }
  return headers;
}

/** product_jqm2.pl answers `{"status": 1, "status_verbose": "fields saved"}` on success. */
function parseWriteResponse(text: string): { ok: boolean; message: string } {
  try {
    const json = JSON.parse(text) as { status?: unknown; status_verbose?: unknown };
    return {
      ok: json.status === 1 || json.status === '1',
      message: typeof json.status_verbose === 'string' ? json.status_verbose : text,
    };
  } catch {
    return { ok: false, message: text.replace(/\s+/g, ' ').trim().slice(0, 200) };
  }
}

/**
 * Writes product data to Open Food Facts (staging in development builds, production
 * in release builds, see config.ts). Credentials live in the device's secure store.
 */
export class OpenFoodFactsWriteClient {
  private readonly uploadUrl = `${WRITE_BASE_URL}/cgi/product_jqm2.pl`;

  async verifyCredentials(username: string, password: string): Promise<void> {
    const formData = new FormData();
    formData.append('user_id', username);
    formData.append('password', password);

    let response: Response;
    try {
      response = await fetchWithTimeout(
        this.uploadUrl,
        { method: 'POST', body: formData, headers: writeHeaders() },
        WRITE_TIMEOUT_MS
      );
    } catch (error) {
      throw new UploadError('Credentials could not be checked', 'network', error);
    }

    const text = await response.text().catch(() => '');
    if (response.status === 403 || /invalid (user|password)/i.test(text)) {
      throw new UploadError('Invalid username or password', 'invalid-credentials');
    }
    if (!response.ok) {
      throw new UploadError(`Credentials could not be checked: HTTP ${response.status}`, 'network');
    }
  }

  async saveCredentials(username: string, password: string): Promise<void> {
    await this.verifyCredentials(username, password);
    await SecureStore.setItemAsync(USERNAME_KEY, username);
    await SecureStore.setItemAsync(PASSWORD_KEY, password);
  }

  async loadCredentials(): Promise<OffCredentials | null> {
    const [username, password] = await Promise.all([
      SecureStore.getItemAsync(USERNAME_KEY),
      SecureStore.getItemAsync(PASSWORD_KEY),
    ]);
    return username && password ? { username, password } : null;
  }

  async deleteCredentials(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(USERNAME_KEY),
      SecureStore.deleteItemAsync(PASSWORD_KEY),
    ]);
  }

  /** Sends product fields (OFF write API names). Empty values are never sent. */
  async updateProduct(barcode: string, fields: Record<string, string | undefined>): Promise<void> {
    const credentials = await this.loadCredentials();
    if (!credentials) {
      throw new UploadError('No credentials stored', 'no-credentials');
    }

    return retryWithBackoff(
      async () => {
        const formData = new FormData();
        formData.append('code', barcode);
        formData.append('user_id', credentials.username);
        formData.append('password', credentials.password);
        formData.append('app_name', APP_NAME);
        formData.append('app_version', APP_VERSION);
        formData.append('app_uuid', generateAppUUID(credentials.username));
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined && value !== null && value.trim() !== '') {
            formData.append(key, value);
          }
        }

        let response: Response;
        try {
          response = await fetchWithTimeout(
            this.uploadUrl,
            { method: 'POST', body: formData, headers: writeHeaders() },
            WRITE_TIMEOUT_MS
          );
        } catch (error) {
          throw new UploadError('Network error during upload', 'network', error);
        }

        if (!response.ok) {
          const error = ApiError.fromHttpStatus(response.status);
          if (error.retryable) throw error;
          throw new UploadError(`Upload failed: HTTP ${response.status}`, 'rejected', error);
        }

        const result = parseWriteResponse(await response.text());
        if (!result.ok) {
          throw new UploadError(`Upload rejected: ${result.message || 'empty response'}`);
        }
      },
      { retries: 2, baseDelayMs: 2000 }
    ).catch((error: unknown) => {
      if (error instanceof UploadError) throw error;
      throw new UploadError(
        `Failed to upload product: ${error instanceof Error ? error.message : String(error)}`,
        'network',
        error
      );
    });
  }
}
