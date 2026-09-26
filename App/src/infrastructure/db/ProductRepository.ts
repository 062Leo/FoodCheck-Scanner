import { getDatabase } from './DatabaseService';
import type { ProductRecord, ProductSummary } from '../../types/Product';
import type { ScanStatus } from '../../types/ScanResult';
import { getErrorMessage } from '../../shared/errors';

const RECORD_COLUMNS = `
  id, ean, name, brands, ingredients, nova_score, nutriscore, raw_json, scanned_at, rating,
  data_version, last_api_fetch, image_url, image_ingredients_url, image_nutrition_url,
  image_packaging_url, visit_count, last_seen_at, edited_at, edited_fields
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

  /** Puts back a deleted product exactly as it was (same id, counters and edit markers). */
  async restore(product: ProductRecord): Promise<void> {
    try {
      const database = await getDatabase();
      await database.runAsync(
        `
          INSERT OR REPLACE INTO products (id, ${INSERT_COLUMNS}, edited_at, edited_fields)
          VALUES ($id, ${INSERT_VALUES}, $edited_at, $edited_fields);
        `,
        {
          ...toParams(product),
          $id: product.id ?? null,
          $edited_at: product.edited_at ?? null,
          $edited_fields: product.edited_fields ?? null,
        }
      );
    } catch (error) {
      throw new Error(`Failed to restore product ${product.ean}: ${getErrorMessage(error)}`, {
        cause: error,
      });
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

  /**
   * Stores a product edited on this device: updates the data, marks it as edited and
   * records which fields the user changed. Creates the product if it is new. Does
   * not count as a scan.
   */
  async saveEdit(product: ProductRecord, editedFields: string | null): Promise<void> {
    try {
      const database = await getDatabase();
      await database.runAsync(
        `
          INSERT INTO products (${INSERT_COLUMNS}, edited_at, edited_fields)
          VALUES (${INSERT_VALUES}, $edited_at, $edited_fields)
          ON CONFLICT(ean) DO UPDATE SET
            ${DATA_ASSIGNMENTS},
            edited_at = excluded.edited_at,
            edited_fields = excluded.edited_fields;
        `,
        {
          ...toParams(product),
          $edited_at: product.edited_at ?? new Date().toISOString(),
          $edited_fields: editedFields,
        }
      );
    } catch (error) {
      throw new Error(
        `Failed to save edited product with EAN ${product.ean}: ${getErrorMessage(error)}`,
        { cause: error }
      );
    }
  }
}
