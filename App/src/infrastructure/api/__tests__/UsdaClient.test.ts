import {
  UsdaClient,
  UsdaError,
  gtinQuery,
  mapUsdaFood,
  pickFood,
  readableName,
  type UsdaFood,
} from '../UsdaClient';
import { NetworkError } from '../fetchWithTimeout';
import { usdaBrandedSearch } from '../__fixtures__/usdaBrandedSearch';
import { rateProduct } from '../../../domain/analysis/rateProduct';
import { SEEDED_RULES } from '../../../domain/analysis/__fixtures__/goldenRuleSets';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const KEY = 'test-key';
/** EAN-13 form of the fixture's UPC-A 012345678905 (stored by FDC as 00012345678905). */
const EAN = '0012345678905';

function respond(status: number, body: unknown) {
  (fetch as jest.Mock).mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('UsdaClient', () => {
  const client = new UsdaClient();

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  describe('findByGtin', () => {
    it('searches branded foods for every length of the barcode with the key in a header', async () => {
      respond(200, usdaBrandedSearch);
      const log = jest.spyOn(console, 'log').mockImplementation(() => {});

      await client.findByGtin(EAN, KEY);

      const [url, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://api.nal.usda.gov/fdc/v1/foods/search');
      expect(parsed.searchParams.get('dataType')).toBe('Branded');
      expect(parsed.searchParams.get('query')).toBe(
        '0012345678905 OR 012345678905 OR 00012345678905'
      );
      expect(url).not.toContain(KEY);
      expect((init.headers as Record<string, string>)['X-Api-Key']).toBe(KEY);
      expect(log).not.toHaveBeenCalled();
    });

    it('maps the matching food, including salt from sodium', async () => {
      respond(200, usdaBrandedSearch);

      const product = await client.findByGtin(EAN, KEY);

      expect(product).toMatchObject({
        ean: EAN,
        name: 'Oat Cereal Rings',
        brand: 'Oat Rings',
        brandOwner: 'EXAMPLE FOODS INC.',
        categories: 'Processed Cereal Products',
        quantity: '18 oz',
        servingSize: '20 g',
        source: 'usda',
      });
      expect(product?.ingredientsText).toMatch(/^WHOLE GRAIN OATS, CORN STARCH/);
      expect(product?.ingredientsTextEn).toBe(product?.ingredientsText);
      expect(product?.ingredientsTextByLang).toEqual({ en: product?.ingredientsText });
      // The first entry is the product as sold; the second one (117 kcal) as prepared.
      expect(product?.nutriments).toEqual({
        energyKcal100g: 359,
        fat100g: 6.41,
        saturatedFat100g: 1.28,
        carbohydrates100g: 74.4,
        sugars100g: 5.13,
        fiber100g: 10.3,
        proteins100g: 12.8,
        salt100g: 1.218, // 487 mg sodium × 2.5
      });
      expect(product?.categoriesTags).toBeUndefined();
      expect(product?.novaScore).toBeUndefined();
      expect(product?.imageUrl).toBeUndefined();
    });

    it('returns null when no result has this barcode', async () => {
      respond(200, {
        foods: [{ ...usdaBrandedSearch.foods[0], gtinUpc: '00012345678912' }],
      });
      expect(await client.findByGtin(EAN, KEY)).toBeNull();

      respond(200, { totalHits: 0, foods: [] });
      expect(await client.findByGtin(EAN, KEY)).toBeNull();
    });

    it.each([
      [403, { error: { code: 'API_KEY_INVALID', message: 'An invalid api_key was supplied.' } }],
      [403, { error: { code: 'API_KEY_MISSING', message: 'No api_key was supplied.' } }],
    ])('reports a rejected key (%s)', async (status, body) => {
      respond(status, body);
      const error = await client.findByGtin(EAN, KEY).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UsdaError);
      expect((error as UsdaError).code).toBe('invalid-key');
      expect((error as UsdaError).message).not.toContain(KEY);
    });

    it('reports the rate limit', async () => {
      respond(429, {
        error: { code: 'OVER_RATE_LIMIT', message: 'You have exceeded your rate limit.' },
      });
      await expect(client.findByGtin(EAN, KEY)).rejects.toMatchObject({ code: 'rate-limit' });
    });

    it('reports server errors and unreadable answers', async () => {
      respond(500, null);
      await expect(client.findByGtin(EAN, KEY)).rejects.toMatchObject({ code: 'server' });
    });

    it('reports timeouts and missing connections', async () => {
      jest.useFakeTimers();
      try {
        (fetch as jest.Mock).mockImplementation(
          (_url: string, init: RequestInit) =>
            new Promise((_, reject) =>
              init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
            )
        );
        const pending = client.findByGtin(EAN, KEY).catch((e: unknown) => e);
        jest.advanceTimersByTime(8000);
        expect(await pending).toMatchObject({ code: 'timeout' });
      } finally {
        jest.useRealTimers();
      }

      (fetch as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
      const error = await client.findByGtin(EAN, KEY).catch((e: unknown) => e);
      expect(error).toMatchObject({ code: 'network' });
      expect(error).not.toBeInstanceOf(NetworkError);
    });
  });

  describe('gtinQuery', () => {
    it('lists the 12, 13 and 14 digit forms once', () => {
      expect(gtinQuery('012345678905')).toBe('012345678905 OR 0012345678905 OR 00012345678905');
    });

    it('also keeps the 8 digit form of a short code', () => {
      expect(gtinQuery('40123455')).toBe(
        '40123455 OR 000040123455 OR 0000040123455 OR 00000040123455'
      );
    });
  });

  describe('pickFood', () => {
    const food = (gtinUpc: string, extra: Partial<UsdaFood> = {}): UsdaFood => ({
      gtinUpc,
      description: gtinUpc,
      ...extra,
    });

    it('matches regardless of leading zeros', () => {
      expect(pickFood([food('12345678905')], '0012345678905')?.gtinUpc).toBe('12345678905');
      expect(pickFood([food('0012345678905')], '012345678905')?.gtinUpc).toBe('0012345678905');
      expect(pickFood([food('112345678905')], '0012345678905')).toBeNull();
    });

    it('prefers the most recently published or modified entry', () => {
      const picked = pickFood(
        [
          food('012345678905', {
            fdcId: 1,
            publishedDate: '2020-02-27',
            modifiedDate: '2019-03-28',
          }),
          food('00012345678905', { fdcId: 2, publishedDate: '2026-09-24' }),
          food('0012345678905', { fdcId: 3, modifiedDate: '2024-01-01' }),
          food('00099999999999', { fdcId: 4, publishedDate: '2027-01-01' }),
        ],
        '0012345678905'
      );
      expect(picked?.fdcId).toBe(2);
    });
  });

  describe('mapping', () => {
    it('title-cases names only when they are written in capitals', () => {
      expect(readableName('CHOCOLATE CHIP COOKIES')).toBe('Chocolate Chip Cookies');
      expect(readableName("KELLOGG'S FROSTED FLAKES")).toBe("Kellogg's Frosted Flakes");
      expect(readableName('Cheerios Cereal')).toBe('Cheerios Cereal');
      expect(readableName('BBQ sauce')).toBe('BBQ sauce');
      expect(readableName('100%')).toBe('100%');
    });

    it('falls back to the brand owner and converts sodium in grams', () => {
      const product = mapUsdaFood(EAN, {
        description: 'Salted Butter',
        brandOwner: 'Example Dairy',
        foodNutrients: [{ nutrientNumber: '307', unitName: 'G', value: 0.6 }],
      });
      expect(product.brand).toBe('Example Dairy');
      expect(product.nutriments).toEqual({ salt100g: 1.5 });
      expect(product.ingredientsText).toBeUndefined();
    });

    it('rates ingredients in capitals like the same text in lower case', () => {
      const text = usdaBrandedSearch.foods[0].ingredients;
      const upper = rateProduct({ ean: EAN, name: 'x', ingredientsText: text }, SEEDED_RULES);
      const lower = rateProduct(
        { ean: EAN, name: 'x', ingredientsText: text.toLowerCase() },
        SEEDED_RULES
      );
      expect(upper.status).toBe(lower.status);
      expect(
        upper.redFlags.map(
          (flag) => `${flag.category}:${flag.canonicalKey ?? flag.ingredient.toLowerCase()}`
        )
      ).toEqual(
        lower.redFlags.map(
          (flag) => `${flag.category}:${flag.canonicalKey ?? flag.ingredient.toLowerCase()}`
        )
      );

      const palm = (ingredientsText: string) =>
        rateProduct({ ean: EAN, name: 'x', ingredientsText }, SEEDED_RULES).redFlags.length;
      expect(palm('SUGAR, PALM OIL, SALT, SOY LECITHIN')).toBe(
        palm('sugar, palm oil, salt, soy lecithin')
      );
      expect(palm('SUGAR, PALM OIL, SALT, SOY LECITHIN')).toBeGreaterThan(0);
    });
  });
});
