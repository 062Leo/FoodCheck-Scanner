export const APP_NAME = 'FoodCheck';
export const APP_VERSION = '1.0';
export const APP_EMAIL = 'foodcheck@example.com';

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

export const USER_AGENT = `${APP_NAME}/${APP_VERSION} (${APP_EMAIL})`;

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
