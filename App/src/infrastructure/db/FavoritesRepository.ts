import { getDatabase } from './DatabaseService';
import { getErrorMessage } from '../../shared/errors';
import type { ProductSummary } from '../../types/Product';

export class FavoritesRepository {
  /**
   * Idempotent: adding an existing favorite is a no-op. `addedAt` puts a favorite back at its
   * old position, e.g. when a removal is undone.
   */
  async add(productId: number, addedAt: string = new Date().toISOString()): Promise<void> {
    try {
      const database = await getDatabase();
      await database.runAsync(
        `
          INSERT OR IGNORE INTO favorites (product_id, added_at)
          VALUES ($product_id, $added_at);
        `,
        {
          $product_id: productId,
          $added_at: addedAt,
        }
      );
    } catch (error) {
      throw new Error(
        `Failed to add product ${productId} to favorites: ${getErrorMessage(error)}`,
        { cause: error }
      );
    }
  }

  async remove(productId: number): Promise<void> {
    try {
      const database = await getDatabase();
      await database.runAsync('DELETE FROM favorites WHERE product_id = $product_id;', {
        $product_id: productId,
      });
    } catch (error) {
      throw new Error(
        `Failed to remove product ${productId} from favorites: ${getErrorMessage(error)}`,
        { cause: error }
      );
    }
  }

  /** Favorite products, most recently added first, without raw_json. */
  async findAll(): Promise<ProductSummary[]> {
    try {
      const database = await getDatabase();
      return await database.getAllAsync<ProductSummary>(
        `
          SELECT
            p.id, p.ean, p.name, p.brands, p.nova_score, p.nutriscore, p.scanned_at, p.rating,
            p.visit_count, p.last_seen_at, p.image_url, p.edited_at,
            CASE WHEN p.ingredients IS NOT NULL AND trim(p.ingredients) <> '' THEN 1 ELSE 0 END
              AS has_ingredients
          FROM favorites f
          INNER JOIN products p ON p.id = f.product_id
          ORDER BY f.added_at DESC, f.id DESC;
        `
      );
    } catch (error) {
      throw new Error(`Failed to load favorite products: ${getErrorMessage(error)}`, {
        cause: error,
      });
    }
  }

  async isFavorite(productId: number): Promise<boolean> {
    try {
      const database = await getDatabase();
      const favorite = await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM favorites WHERE product_id = $product_id LIMIT 1;',
        { $product_id: productId }
      );
      return favorite !== null;
    } catch (error) {
      throw new Error(
        `Failed to check favorite state for product ${productId}: ${getErrorMessage(error)}`,
        { cause: error }
      );
    }
  }

  /** When the product was made a favorite, or null if it is none. */
  async findAddedAt(productId: number): Promise<string | null> {
    try {
      const database = await getDatabase();
      const favorite = await database.getFirstAsync<{ added_at: string }>(
        'SELECT added_at FROM favorites WHERE product_id = $product_id LIMIT 1;',
        { $product_id: productId }
      );
      return favorite?.added_at ?? null;
    } catch (error) {
      throw new Error(
        `Failed to read favorite state for product ${productId}: ${getErrorMessage(error)}`,
        { cause: error }
      );
    }
  }
}
