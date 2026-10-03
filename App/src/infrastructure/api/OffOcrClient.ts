import { STAGING_AUTH, USER_AGENT, WRITE_BASE_URL, WRITE_ENV, WRITE_IMAGES_URL } from './config';
import { OpenFoodFactsWriteClient } from './OpenFoodFactsWriteClient';
import { fetchWithTimeout } from './fetchWithTimeout';

export type OffOcrErrorCode = 'no-credentials' | 'upload-failed' | 'timeout' | 'cancelled';

export class OffOcrError extends Error {
  constructor(
    public readonly code: OffOcrErrorCode,
    message: string = code
  ) {
    super(message);
    this.name = 'OffOcrError';
  }
}

/** Folder of a product's images: codes of up to 8 digits are not split. */
export function barcodePath(barcode: string): string {
  if (barcode.length <= 8) return barcode;
  const padded = barcode.padStart(13, '0');
  return `${padded.slice(0, 3)}/${padded.slice(3, 6)}/${padded.slice(6, 9)}/${padded.slice(9)}`;
}

function headers(): Record<string, string> {
  const result: Record<string, string> = { 'User-Agent': USER_AGENT };
  if (WRITE_ENV === 'staging') result.Authorization = STAGING_AUTH;
  return result;
}

/**
 * Text recognition by Open Food Facts (Google Cloud Vision). Uploads the photo as a
 * product image under the user's account, which makes it public. Only used after the
 * user explicitly agreed; on-device recognition is the default.
 */
export class OffOcrClient {
  constructor(private readonly credentialsSource = new OpenFoodFactsWriteClient()) {}

  async extractText(
    barcode: string,
    imageUri: string,
    field: 'ingredients' | 'nutrition',
    language: string,
    /** Stops the upload if it is still running, and the waiting for the result. */
    signal?: AbortSignal
  ): Promise<string> {
    const imgid = await this.uploadImage(barcode, imageUri, `${field}_${language}`, signal);
    return this.waitForOcr(barcode, imgid, signal);
  }

  private async uploadImage(
    barcode: string,
    imageUri: string,
    imagefield: string,
    signal?: AbortSignal
  ) {
    const credentials = await this.credentialsSource.loadCredentials();
    if (!credentials) throw new OffOcrError('no-credentials');

    const formData = new FormData();
    formData.append('user_id', credentials.username);
    formData.append('password', credentials.password);
    formData.append('code', barcode);
    formData.append('imagefield', imagefield);
    // React Native FormData accepts { uri, type, name } for files.
    formData.append(`imgupload_${imagefield}`, {
      uri: imageUri,
      type: 'image/jpeg',
      name: `${imagefield}.jpg`,
    } as unknown as Blob);

    const response = await fetchWithTimeout(
      `${WRITE_BASE_URL}/cgi/product_image_upload.pl`,
      { method: 'POST', body: formData, headers: headers(), signal },
      30000
    ).catch((error) => {
      throw new OffOcrError(signal?.aborted ? 'cancelled' : 'upload-failed', String(error));
    });
    if (!response.ok) throw new OffOcrError('upload-failed', `HTTP ${response.status}`);

    const data = (await response.json().catch(() => ({}))) as {
      imgid?: number;
      image?: { imgid?: number };
      status?: string;
    };
    const imgid = data.image?.imgid ?? data.imgid;
    if (!imgid) throw new OffOcrError('upload-failed', data.status ?? 'no imgid');
    return imgid;
  }

  private async waitForOcr(
    barcode: string,
    imgid: number,
    signal?: AbortSignal,
    attempts = 10
  ): Promise<string> {
    const url = `${WRITE_IMAGES_URL}/images/products/${barcodePath(barcode)}/${imgid}.json`;
    for (let i = 0; i < attempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (signal?.aborted) throw new OffOcrError('cancelled');
      try {
        const response = await fetchWithTimeout(url, { headers: headers(), signal }, 8000);
        if (!response.ok) continue;
        const data = (await response.json()) as {
          responses?: Array<{ fullTextAnnotation?: { text?: string } }>;
        };
        const text = data?.responses?.[0]?.fullTextAnnotation?.text;
        if (text) return text;
      } catch {
        // try again
      }
    }
    throw new OffOcrError('timeout');
  }
}
