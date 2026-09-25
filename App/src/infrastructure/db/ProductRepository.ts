import { getDatabase } from './DatabaseService';
import type { ProductRecord, ProductSummary } from '../../types/Product';
import type { ScanStatus } from '../../types/ScanResult';
import { toNovaScore } from '../../domain/analysis/ProductRating';
import { getErrorMessage } from '../../shared/errors';

const RECORD_COLUMNS = `
  id, ean, name, brands, ingredients, nova_score, nutriscore, raw_json, scanned_at, rating,
  data_version, last_api_fetch, image_url, image_ingredients_url, image_nutrition_url,
  image_packaging_url, visit_count, last_seen_at, edited_at
`;

/** Columns needed for lists; skips the large raw_json payload. */
const SUMMARY_COLUMNS = `
  id, ean, name, brands, nova_score, nutriscore, scanned_at, rating, visit_count,
  last_seen_at, image_url, edited_at,
  CASE WHEN ingredients IS NOT NULL AND trim(ingredients) <> '' THEN 1 ELSE 0 END AS has_ingredients
`;

/** Data columns that an Open Food Facts refresh may overwrite. */
const DATA_ASSIGNMENTS = `
  name = excluded.name,
  brands = excluded.brands,
  ingredients = excluded.ingredients,
  nova_score = excluded.nova_score,
  nutriscore = excluded.nutriscore,
  raw_json = excluded.raw_json,
  rating = excluded.rating,
  data_version = excluded.data_version,
  last_api_fetch = excluded.last_api_fetch,
  image_url = excluded.image_url,
  image_ingredients_url = excluded.image_ingredients_url,
  image_nutrition_url = excluded.image_nutrition_url,
  image_packaging_url = excluded.image_packaging_url
`;

const INSERT_COLUMNS = `
  ean, name, brands, ingredients, nova_score, nutriscore, raw_json, scanned_at, rating,
  data_version, last_api_fetch, image_url, image_ingredients_url, image_nutrition_url,
  image_packaging_url, visit_count, last_seen_at
`;

const INSERT_VALUES = `
  $ean, $name, $brands, $ingredients, $nova_score, $nutriscore, $raw_json, $scanned_at, $rating,
  $data_version, $last_api_fetch, $image_url, $image_ingredients_url, $image_nutrition_url,
  $image_packaging_url, $visit_count, $last_seen_at
`;

function toParams(product: ProductRecord) {
  return {
    $ean: product.ean,
    $name: product.name,
    $brands: product.brands,
    $ingredients: product.ingredients,
    $nova_score: product.nova_score,
    $nutriscore: product.nutriscore,
    $raw_json: product.raw_json,
    $scanned_at: product.scanned_at,
    $rating: product.rating,
    $data_version: product.data_version ?? null,
    $last_api_fetch: product.last_api_fetch ?? null,
    $image_url: product.image_url ?? null,
    $image_ingredients_url: product.image_ingredients_url ?? null,
    $image_nutrition_url: product.image_nutrition_url ?? null,
    $image_packaging_url: product.image_packaging_url ?? null,
    $visit_count: product.visit_count ?? 1,
    $last_seen_at: product.last_seen_at ?? product.scanned_at,
  };
}

export type RatingInput = Pick<
  ProductRecord,
  'ean' | 'name' | 'brands' | 'ingredients' | 'nova_score' | 'raw_json' | 'rating'
>;

export class ProductRepository {
  /**
   * Stores the result of a barcode scan: inserts the product or updates its data and
   * counts the scan (visit_count + 1, scanned_at/last_seen_at = now).
   */
  async saveScan(product: ProductRecord): Promise<void> {
    try {
      const database = await getDatabase();
      await database.runAsync(
        `
          INSERT INTO products (${INSERT_COLUMNS}) VALUES (${INSERT_VALUES})
          ON CONFLICT(ean) DO UPDATE SET
            ${DATA_ASSIGNMENTS},
            scanned_at = excluded.scanned_at,
            last_seen_at = excluded.last_seen_at,
            visit_count = COALESCE(products.visit_count, 0) + 1;
        `,
        toParams(product)
      );
    } catch (error) {
      throw new Error(
        `Failed to save scan of product with EAN ${product.ean}: ${getErrorMessage(error)}`,
        { cause: error }
      );
    }
  }

  /**
   * Stores fresh data for a product that was only viewed (e.g. opened from the catalog).
   * Does not count as a scan: visit_count and scanned_at stay unchanged.
   */
  async saveRefresh(product: ProductRecord): Promise<void> {
    try {
      const database = await getDatabase();
      await database.runAsync(
        `
          INSERT INTO products (${INSERT_COLUMNS}) VALUES (${INSERT_VALUES})
          ON CONFLICT(ean) DO UPDATE SET ${DATA_ASSIGNMENTS};
        `,
        toParams(product)
      );
    } catch (error) {
      throw new Error(
        `Failed to refresh product with EAN ${product.ean}: ${getErrorMessage(error)}`,
        { cause: error }
      );
    }
  }

  async findByEan(ean: string): Promise<ProductRecord | null> {
    try {
      const database = await getDatabase();
      const product = await database.getFirstAsync<ProductRecord>(
        `SELECT ${RECORD_COLUMNS} FROM products WHERE ean = $ean LIMIT 1;`,
        { $ean: ean }
      );
      return product ?? null;
    } catch (error) {
      throw new Error(`Failed to find product by EAN ${ean}: ${getErrorMessage(error)}`, {
        cause: error,
      });
    }
  }

  /** All products, most recent scan first, without raw_json. */
  async findAllSummaries(): Promise<ProductSummary[]> {
    try {
      const database = await getDatabase();
      return await database.getAllAsync<ProductSummary>(
        `SELECT ${SUMMARY_COLUMNS} FROM products ORDER BY scanned_at DESC, id DESC;`
      );
    } catch (error) {
      throw new Error(`Failed to load products: ${getErrorMessage(error)}`, { cause: error });
    }
  }

  /** The fields needed to re-rate every stored product. */
  async findAllForRating(): Promise<RatingInput[]> {
    try {
      const database = await getDatabase();
      return await database.getAllAsync<RatingInput>(
        'SELECT ean, name, brands, ingredients, nova_score, raw_json, rating FROM products;'
      );
    } catch (error) {
      throw new Error(`Failed to load products for rating: ${getErrorMessage(error)}`, {
        cause: error,
      });
    }
  }

  /** Writes new ratings in one transaction. */
  async updateRatings(changes: Array<{ ean: string; rating: ScanStatus }>): Promise<void> {
    if (changes.length === 0) return;
    try {
      const database = await getDatabase();
      await database.withTransactionAsync(async () => {
        for (const change of changes) {
          await database.runAsync('UPDATE products SET rating = $rating WHERE ean = $ean;', {
            $rating: change.rating,
            $ean: change.ean,
          });
        }
      });
    } catch (error) {
      throw new Error(`Failed to update ratings: ${getErrorMessage(error)}`, { cause: error });
    }
  }

  async deleteByEan(ean: string): Promise<void> {
    try {
      const database = await getDatabase();
      await database.runAsync('DELETE FROM products WHERE ean = $ean;', { $ean: ean });
    } catch (error) {
      throw new Error(`Failed to delete product by EAN ${ean}: ${getErrorMessage(error)}`, {
        cause: error,
      });
    }
  }

  async updateProduct(product: {
    ean: string;
    name?: string;
    brands?: string;
    category?: string;
    ingredients?: string;
    ingredientsTextDe?: string;
    ingredientsTextEn?: string;
    ingredientsByLang?: Record<string, string>;
    nutriments?: Record<string, number | undefined>;
    quantity?: string;
    allergensTags?: string;
    traces?: string;
    origins?: string;
    manufacturingPlaces?: string;
    stores?: string;
    servingSize?: string;
    novaScore?: number;
  }): Promise<void> {
    try {
      const database = await getDatabase();
      const existing = await this.findByEan(product.ean);
      if (!existing) throw new Error('Product not found');

      let updatedRawJson = existing.raw_json;
      if (existing.raw_json) {
        try {
          const parsed = JSON.parse(existing.raw_json);
          const target: Record<string, unknown> = parsed.product ?? parsed;
          let modified = false;

          if (product.name !== undefined) {
            target.name = product.name;
            modified = true;
          }
          if (product.brands !== undefined) {
            target.brand = product.brands;
            modified = true;
          }
          if (product.category !== undefined) {
            target.categories = product.category;
            modified = true;
          }
          if (product.ingredients !== undefined) {
            target.ingredientsText = product.ingredients;
            modified = true;
          }
          if (product.ingredientsTextDe !== undefined) {
            target.ingredientsTextDe = product.ingredientsTextDe;
            target.ingredients_text_de = product.ingredientsTextDe;
            modified = true;
          }
          if (product.ingredientsTextEn !== undefined) {
            target.ingredientsTextEn = product.ingredientsTextEn;
            target.ingredients_text_en = product.ingredientsTextEn;
            modified = true;
          }
          if (product.ingredientsByLang !== undefined) {
            target.ingredientsTextByLang = product.ingredientsByLang;
            Object.entries(product.ingredientsByLang).forEach(([lang, text]) => {
              target[`ingredients_text_${lang}`] = text;
            });
            modified = true;
          }
          if (product.quantity !== undefined) {
            target.quantity = product.quantity;
            modified = true;
          }
          if (product.allergensTags !== undefined) {
            target.allergensTags = product.allergensTags
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            modified = true;
          }
          if (product.traces !== undefined) {
            target.traces = product.traces;
            modified = true;
          }
          if (product.origins !== undefined) {
            target.origins = product.origins;
            modified = true;
          }
          if (product.manufacturingPlaces !== undefined) {
            target.manufacturingPlaces = product.manufacturingPlaces;
            modified = true;
          }
          if (product.stores !== undefined) {
            target.stores = product.stores;
            modified = true;
          }
          if (product.servingSize !== undefined) {
            target.servingSize = product.servingSize;
            modified = true;
          }
          if (product.novaScore !== undefined) {
            target.novaScore = product.novaScore;
            modified = true;
          }

          if (product.nutriments) {
            const n = product.nutriments;
            const existingNuts = (target.nutriments as Record<string, unknown>) || {};
            target.nutriments = existingNuts;
            if (n.energyKcal100g !== undefined) existingNuts.energyKcal100g = n.energyKcal100g;
            if (n.fat100g !== undefined) existingNuts.fat100g = n.fat100g;
            if (n.saturatedFat100g !== undefined)
              existingNuts.saturatedFat100g = n.saturatedFat100g;
            if (n.carbohydrates100g !== undefined)
              existingNuts.carbohydrates100g = n.carbohydrates100g;
            if (n.sugars100g !== undefined) existingNuts.sugars100g = n.sugars100g;
            if (n.fiber100g !== undefined) existingNuts.fiber100g = n.fiber100g;
            if (n.proteins100g !== undefined) existingNuts.proteins100g = n.proteins100g;
            if (n.salt100g !== undefined) existingNuts.salt100g = n.salt100g;
            modified = true;
          }
          if (product.brands !== undefined) {
            target.brands = product.brands;
            modified = true;
          }
          if (product.category !== undefined) {
            target.categories = product.category;
            modified = true;
          }
          if (product.ingredients !== undefined) {
            target.ingredients_text = product.ingredients;
            modified = true;
          }
          if (product.ingredientsTextDe !== undefined) {
            target.ingredientsTextDe = product.ingredientsTextDe;
            target.ingredients_text_de = product.ingredientsTextDe;
            modified = true;
          }
          if (product.ingredientsTextEn !== undefined) {
            target.ingredientsTextEn = product.ingredientsTextEn;
            target.ingredients_text_en = product.ingredientsTextEn;
            modified = true;
          }
          if (product.ingredientsByLang !== undefined) {
            target.ingredientsTextByLang = product.ingredientsByLang;
            Object.entries(product.ingredientsByLang).forEach(([lang, text]) => {
              target[`ingredients_text_${lang}`] = text;
            });
            modified = true;
          }
          if (product.quantity !== undefined) {
            target.quantity = product.quantity;
            modified = true;
          }
          if (product.allergensTags !== undefined) {
            target.allergens_tags = product.allergensTags
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            modified = true;
          }
          if (product.traces !== undefined) {
            target.traces = product.traces;
            modified = true;
          }
          if (product.origins !== undefined) {
            target.origins = product.origins;
            modified = true;
          }
          if (product.manufacturingPlaces !== undefined) {
            target.manufacturing_places = product.manufacturingPlaces;
            modified = true;
          }
          if (product.stores !== undefined) {
            target.stores = product.stores;
            modified = true;
          }
          if (product.servingSize !== undefined) {
            target.serving_size = product.servingSize;
            modified = true;
          }
          if (product.novaScore !== undefined) {
            target.nova_group = product.novaScore;
            modified = true;
          }

          if (product.nutriments) {
            const n = product.nutriments;
            const existingNuts = (target.nutriments as Record<string, unknown>) || {};
            target.nutriments = existingNuts;
            if (n.energyKcal100g !== undefined) existingNuts['energy-kcal_100g'] = n.energyKcal100g;
            if (n.fat100g !== undefined) existingNuts.fat_100g = n.fat100g;
            if (n.saturatedFat100g !== undefined)
              existingNuts['saturated-fat_100g'] = n.saturatedFat100g;
            if (n.carbohydrates100g !== undefined)
              existingNuts.carbohydrates_100g = n.carbohydrates100g;
            if (n.sugars100g !== undefined) existingNuts.sugars_100g = n.sugars100g;
            if (n.fiber100g !== undefined) existingNuts.fiber_100g = n.fiber100g;
            if (n.proteins100g !== undefined) existingNuts.proteins_100g = n.proteins100g;
            if (n.salt100g !== undefined) existingNuts.salt_100g = n.salt100g;
            modified = true;
          }

          if (modified) updatedRawJson = JSON.stringify(parsed);
        } catch (e) {
          console.error('Failed to parse raw_json during update:', e);
        }
      }

      await database.runAsync(
        `
          UPDATE products
          SET name = coalesce($name, name),
              brands = coalesce($brands, brands),
              ingredients = coalesce($ingredients, ingredients),
              nova_score = CASE WHEN $has_nova = 1 THEN $nova_score ELSE nova_score END,
              raw_json = $raw_json,
              edited_at = $edited_at
          WHERE ean = $ean;
        `,
        {
          $name: product.name ?? null,
          $brands: product.brands ?? null,
          $ingredients: product.ingredients ?? null,
          $raw_json: updatedRawJson,
          $has_nova: product.novaScore !== undefined ? 1 : 0,
          $nova_score: toNovaScore(product.novaScore) ?? null,
          $edited_at: new Date().toISOString(),
          $ean: product.ean,
        }
      );
    } catch (error) {
      throw new Error(`Failed to update product by EAN ${product.ean}: ${getErrorMessage(error)}`, {
        cause: error,
      });
    }
  }

  async searchByName(query: string): Promise<ProductSummary[]> {
    try {
      const database = await getDatabase();
      return await database.getAllAsync<ProductSummary>(
        `
          SELECT ${SUMMARY_COLUMNS}
          FROM products
          WHERE name LIKE $query COLLATE NOCASE
             OR brands LIKE $query COLLATE NOCASE
             OR ean LIKE $query
          ORDER BY scanned_at DESC
          LIMIT 50;
        `,
        { $query: `%${query}%` }
      );
    } catch (error) {
      throw new Error(`Failed to search products: ${getErrorMessage(error)}`, { cause: error });
    }
  }
}
