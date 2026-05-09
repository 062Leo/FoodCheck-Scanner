import { db, initDatabase } from './DatabaseService';
import type { ProductRecord } from '../../types/Product';

type ProductRow = ProductRecord;

export class ProductRepository {
  async insert(product: ProductRecord): Promise<void> {
    try {
      const database = await this.getDatabase();

      await database.runAsync(
        `
          INSERT INTO products (
            ean,
            name,
            brands,
            ingredients,
            nova_score,
            nutriscore,
            raw_json,
            scanned_at,
            rating
          ) VALUES (
            $ean,
            $name,
            $brands,
            $ingredients,
            $nova_score,
            $nutriscore,
            $raw_json,
            $scanned_at,
            $rating
          )
          ON CONFLICT(ean) DO UPDATE SET
            name = excluded.name,
            brands = excluded.brands,
            ingredients = excluded.ingredients,
            nova_score = excluded.nova_score,
            nutriscore = excluded.nutriscore,
            raw_json = excluded.raw_json,
            scanned_at = excluded.scanned_at,
            rating = excluded.rating;
        `,
        {
          $ean: product.ean,
          $name: product.name,
          $brands: product.brands,
          $ingredients: product.ingredients,
          $nova_score: product.nova_score,
          $nutriscore: product.nutriscore,
          $raw_json: product.raw_json,
          $scanned_at: product.scanned_at,
          $rating: product.rating,
        }
      );
    } catch (error) {
      throw new Error(`Failed to insert product with EAN ${product.ean}: ${getErrorMessage(error)}`);
    }
  }

  async findByEan(ean: string): Promise<ProductRecord | null> {
    try {
      const database = await this.getDatabase();

      const product = await database.getFirstAsync<ProductRow>(
        `
          SELECT
            id,
            ean,
            name,
            brands,
            ingredients,
            nova_score,
            nutriscore,
            raw_json,
            scanned_at,
            rating
          FROM products
          WHERE ean = $ean
          LIMIT 1;
        `,
        {
          $ean: ean,
        }
      );

      return product ?? null;
    } catch (error) {
      throw new Error(`Failed to find product by EAN ${ean}: ${getErrorMessage(error)}`);
    }
  }

  async findAll(): Promise<ProductRecord[]> {
    try {
      const database = await this.getDatabase();

      return await database.getAllAsync<ProductRow>(
        `
          SELECT
            id,
            ean,
            name,
            brands,
            ingredients,
            nova_score,
            nutriscore,
            raw_json,
            scanned_at,
            rating
          FROM products
          ORDER BY scanned_at DESC, id DESC;
        `
      );
    } catch (error) {
      throw new Error(`Failed to load products: ${getErrorMessage(error)}`);
    }
  }

  async deleteByEan(ean: string): Promise<void> {
    try {
      const database = await this.getDatabase();

      await database.runAsync(
        `
          DELETE FROM products
          WHERE ean = $ean;
        `,
        {
          $ean: ean,
        }
      );
    } catch (error) {
      throw new Error(`Failed to delete product by EAN ${ean}: ${getErrorMessage(error)}`);
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