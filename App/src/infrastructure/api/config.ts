export const APP_NAME = 'FoodCheck';
export const APP_VERSION = '1.0';

/**
 * Set to `true` during development/testing to use the OFF staging environment
 * (https://world.openfoodfacts.net with Basic Auth off:off).
 * Set to `false` for production (https://world.openfoodfacts.org).
 *
 * Production requires a separate OFF account created at
 * https://world.openfoodfacts.org — credentials are stored on-device
 * via expo-secure-store, never in source code.
 */
export const USE_STAGING = false;

const STAGING_BASE_URL = 'https://world.openfoodfacts.net';
const PRODUCTION_BASE_URL = 'https://world.openfoodfacts.org';

export const BASE_URL = USE_STAGING ? STAGING_BASE_URL : PRODUCTION_BASE_URL;

export type OffEnvironment = 'production' | 'staging';

declare const __DEV__: boolean | undefined;

/**
 * Where contributions (product data, photos for cloud OCR) are written.
 * Development builds write to the staging server so testing never changes real
 * product data; release builds write to production. EXPO_PUBLIC_OFF_WRITE_ENV
 * ('staging' | 'production') overrides this.
 */
export function resolveWriteEnvironment(
  override: string | undefined = process.env.EXPO_PUBLIC_OFF_WRITE_ENV,
  isDev: boolean = typeof __DEV__ !== 'undefined' && Boolean(__DEV__)
): OffEnvironment {
  if (override === 'production' || override === 'staging') return override;
  return isDev ? 'staging' : 'production';
}

export const WRITE_ENV: OffEnvironment = resolveWriteEnvironment();
export const WRITE_BASE_URL = WRITE_ENV === 'staging' ? STAGING_BASE_URL : PRODUCTION_BASE_URL;
export const WRITE_IMAGES_URL =
  WRITE_ENV === 'staging' ? 'https://images.openfoodfacts.net' : 'https://images.openfoodfacts.org';
/** Host name shown to the user before anything is sent. */
export const WRITE_HOST = WRITE_BASE_URL.replace(/^https?:\/\//, '');

/** Identifies the app to Open Food Facts; deliberately without a contact address. */
export const USER_AGENT = `${APP_NAME}/${APP_VERSION}`;

/** Public project page, the contact Wikimedia's User-Agent policy asks for. */
export const PROJECT_URL = 'https://github.com/062Leo/FoodCheck-Scanner';

/** Identifies the app to Wikidata: name, version and project page (no e-mail address). */
export const WIKIMEDIA_USER_AGENT = `${USER_AGENT} (${PROJECT_URL})`;

/** HTTP Basic Auth header value for staging (off:off base64-encoded). */
export const STAGING_AUTH = 'Basic b2ZmOm9mZg==';

/**
 * Produces a deterministic, salted UUID per user.
 * Offline-safe — uses only string hashing, no crypto APIs.
 */
export function generateAppUUID(userId: string): string {
  const key = `foodcheck:${userId}`;

  function djb2(s: string, seed: number): number {
    let h = seed;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }

  const seg = [
    djb2(key, 5381),
    djb2(key, 9034),
    djb2(key, 29108),
    djb2(key, 47821),
    djb2(key, 65321),
  ].map((v) => v.toString(16).padStart(8, '0'));

  const variant = (8 + (Math.abs(djb2(key, 99991)) % 4)).toString(16);

  return [
    seg[0],
    seg[1].substring(0, 4),
    '4' + seg[2].substring(0, 3),
    variant + seg[3].substring(0, 3),
    seg[4].substring(0, 4) + seg[0].substring(4, 8) + seg[1].substring(4, 8),
  ].join('-');
}
