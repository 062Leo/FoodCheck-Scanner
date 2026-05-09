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

  async deleteProduct(ean: string): Promise<void> {
    return this.deleteByEan(ean);
  }

  async updateProduct(product: { ean: string; name?: string; brands?: string; category?: string; ingredients?: string; nutriments?: any }): Promise<void> {
    try {
      const database = await this.getDatabase();
      const existing = await this.findByEan(product.ean);
      if (!existing) throw new Error("Product not found");

      let updatedRawJson = existing.raw_json;
      if (existing.raw_json) {
        try {
          const parsed = JSON.parse(existing.raw_json);
          let modified = false;
          if (product.name !== undefined) { parsed.product_name = product.name; modified = true; }
          if (product.brands !== undefined) { parsed.brands = product.brands; modified = true; }
          if (product.category !== undefined) { parsed.categories = product.category; modified = true; }
          if (product.ingredients !== undefined) { parsed.ingredients_text = product.ingredients; modified = true; }

          if (product.nutriments) {
             const n = product.nutriments;
             if (!parsed.nutriments) parsed.nutriments = {};
             if (n.energyKcal100g !== undefined) parsed.nutriments['energy-kcal_100g'] = n.energyKcal100g;
             if (n.fat100g !== undefined) parsed.nutriments.fat_100g = n.fat100g;
             if (n.saturatedFat100g !== undefined) parsed.nutriments['saturated-fat_100g'] = n.saturatedFat100g;
             if (n.carbohydrates100g !== undefined) parsed.nutriments.carbohydrates_100g = n.carbohydrates100g;
             if (n.sugars100g !== undefined) parsed.nutriments.sugars_100g = n.sugars100g;
             if (n.fiber100g !== undefined) parsed.nutriments.fiber_100g = n.fiber100g;
             if (n.proteins100g !== undefined) parsed.nutriments.proteins_100g = n.proteins100g;
             if (n.salt100g !== undefined) parsed.nutriments.salt_100g = n.salt100g;
             modified = true;
          }

          if (modified) updatedRawJson = JSON.stringify(parsed);
        } catch (e) {
          console.error("Failed to parse raw_json during update:", e);
        }
      }

      await database.runAsync(
        `
          UPDATE products
          SET name = coalesce($name, name),
              brands = coalesce($brands, brands),
              ingredients = coalesce($ingredients, ingredients),
              raw_json = $raw_json
          WHERE ean = $ean;
        `,
        {
          $name: product.name ?? null,
          $brands: product.brands ?? null,
          $ingredients: product.ingredients ?? null,
          $raw_json: updatedRawJson,
          $ean: product.ean,
        }
      );
    } catch (error) {
      throw new Error(`Failed to update product by EAN ${product.ean}: ${getErrorMessage(error)}`);
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