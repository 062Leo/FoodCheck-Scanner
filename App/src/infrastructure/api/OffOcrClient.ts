import { BASE_URL, USER_AGENT, USE_STAGING, STAGING_AUTH } from './config';
import { OpenFoodFactsWriteClient } from './OpenFoodFactsWriteClient';

export class OffOcrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OffOcrError';
  }
}

function barcodePath(barcode: string): string {
  const padded = barcode.padStart(13, '0');
  return `${padded.slice(0, 3)}/${padded.slice(3, 6)}/${padded.slice(6, 9)}/${padded.slice(9)}`;
}

export class OffOcrClient {
  private readonly uploadUrl = `${BASE_URL}/cgi/product_image_upload.pl`;

  /**
   * Full pipeline: upload image to OFF, wait for OCR JSON, return plain text.
   */
  async extractText(
    barcode: string,
    imageUri: string,
    imagefield: 'ingredients' | 'nutrition' = 'ingredients'
  ): Promise<string> {
    const imgid = await this.uploadImage(barcode, imageUri, imagefield);
    const text = await this.waitForOcr(barcode, imgid);
    return text;
  }

  private async uploadImage(
    barcode: string,
    imageUri: string,
    imagefield: string
  ): Promise<number> {
    const credentials = await new OpenFoodFactsWriteClient().loadCredentials();
    if (!credentials) {
      throw new OffOcrError('Keine OFF-Zugangsdaten gespeichert.');
    }

    const formData = new FormData();
    formData.append('user_id', credentials.username);
    formData.append('password', credentials.password);
    formData.append('code', barcode);
    formData.append('imagefield', imagefield);

    // React Native FormData: append file as { uri, type, name }
    formData.append(`imgupload_${imagefield}`, {
      uri: imageUri,
      type: 'image/jpeg',
      name: `${imagefield}.jpg`,
    } as unknown as Blob);

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
    };
    if (USE_STAGING) {
      headers['Authorization'] = STAGING_AUTH;
    }

    const response = await fetch(this.uploadUrl, {
      method: 'POST',
      body: formData,
      headers,
    });

    if (!response.ok) {
      throw new OffOcrError(`Image upload failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as { imgid?: number; status?: string };
    if (!data.imgid) {
      throw new OffOcrError(`Image upload failed: ${data.status || 'no imgid returned'}`);
    }

    return data.imgid;
  }

  private async waitForOcr(barcode: string, imgid: number, maxAttempts = 10): Promise<string> {
    const path = barcodePath(barcode);
    const ocrUrl = `https://images.openfoodfacts.org/images/products/${path}/${imgid}.json`;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      try {
        const response = await fetch(ocrUrl);
        if (!response.ok) continue;

        const data = (await response.json()) as {
          responses?: Array<{ fullTextAnnotation?: { text?: string } }>;
        };

        const text = data?.responses?.[0]?.fullTextAnnotation?.text;
        if (text) return text;
      } catch {
        // Retry
      }
    }

    throw new OffOcrError('OCR-Ergebnis nicht innerhalb der Zeit verfügbar.');
  }
}
