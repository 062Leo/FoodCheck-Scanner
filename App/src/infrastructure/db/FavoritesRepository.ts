import { db, initDatabase } from './DatabaseService';
import type { ProductRecord } from '../../types/Product';

type FavoriteRow = {
  id: number;
  product_id: number;
  added_at: string;
};

export class FavoritesRepository {
  async add(productId: number): Promise<void> {
    try {
      const database = await this.getDatabase();

      await database.runAsync(
        `
          INSERT INTO favorites (product_id, added_at)
          VALUES ($product_id, $added_at);
        `,
        {
          $product_id: productId,
          $added_at: new Date().toISOString(),
        }
      );
    } catch (error) {
      throw new Error(`Failed to add product ${productId} to favorites: ${getErrorMessage(error)}`);
    }
  }

  async remove(productId: number): Promise<void> {
    try {
      const database = await this.getDatabase();

      await database.runAsync(
        `
          DELETE FROM favorites
          WHERE product_id = $product_id;
        `,
        {
          $product_id: productId,
        }
      );
    } catch (error) {
      throw new Error(
        `Failed to remove product ${productId} from favorites: ${getErrorMessage(error)}`
      );
    }
  }

  async findAll(): Promise<ProductRecord[]> {
    try {
      const database = await this.getDatabase();

      return await database.getAllAsync<ProductRecord>(
        `
          SELECT
            p.id,
            p.ean,
            p.name,
            p.brands,
            p.ingredients,
            p.nova_score,
            p.nutriscore,
            p.raw_json,
            p.scanned_at,
            p.rating
          FROM favorites f
          INNER JOIN products p ON p.id = f.product_id
          ORDER BY f.added_at DESC, f.id DESC;
        `
      );
    } catch (error) {
      throw new Error(`Failed to load favorite products: ${getErrorMessage(error)}`);
    }
  }

  async isFavorite(productId: number): Promise<boolean> {
    try {
      const database = await this.getDatabase();

      const favorite = await database.getFirstAsync<{ id: number }>(
        `
          SELECT id
          FROM favorites
          WHERE product_id = $product_id
          LIMIT 1;
        `,
        {
          $product_id: productId,
        }
      );

      return favorite !== null;
    } catch (error) {
      throw new Error(
        `Failed to check favorite state for product ${productId}: ${getErrorMessage(error)}`
      );
    }
  }

  private async getDatabase() {
    if (db) {
      return db;
    }

    await initDatabase();

    if (!db) {
      throw new Error('SQLite database is not available after initialization.');
    }

    return db;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
