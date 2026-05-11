import { db, initDatabase } from './DatabaseService';
import type { FilterRule, NewFilterRule } from '../../types/FilterRule';

export class FilterRuleRepository {
  async insert(rule: NewFilterRule): Promise<void> {
    try {
      const database = await this.getDatabase();

      await database.runAsync(
        `
          INSERT INTO filter_rules (type, key, category, threshold, operator, severity, created_at)
          VALUES ($type, $key, $category, $threshold, $operator, $severity, $created_at);
        `,
        {
          $type: rule.type,
          $key: rule.key,
          $category: rule.category,
          $threshold: rule.threshold ?? null,
          $operator: rule.operator ?? null,
          $severity: rule.severity,
          $created_at: rule.created_at,
        }
      );
    } catch (error) {
      throw new Error(
        `Failed to insert filter rule for key ${rule.key}: ${getErrorMessage(error)}`
      );
    }
  }

  async findAll(): Promise<FilterRule[]> {
    try {
      const database = await this.getDatabase();

      return await database.getAllAsync<FilterRule>(
        `
          SELECT
            id,
            type,
            key,
            category,
            threshold,
            operator,
            severity,
            created_at
          FROM filter_rules
          ORDER BY category ASC, created_at ASC, id ASC;
        `
      );
    } catch (error) {
      throw new Error(`Failed to load filter rules: ${getErrorMessage(error)}`);
    }
  }

  async update(id: number, changes: Partial<NewFilterRule>): Promise<void> {
    try {
      const database = await this.getDatabase();

      const setClauses: string[] = [];
      const params: Record<string, unknown> = { $id: id };

      if (changes.type !== undefined) {
        setClauses.push('type = $type');
        params.$type = changes.type;
      }

      if (changes.key !== undefined) {
        setClauses.push('key = $key');
        params.$key = changes.key;
      }

      if (changes.category !== undefined) {
        setClauses.push('category = $category');
        params.$category = changes.category;
      }

      if (changes.threshold !== undefined) {
        setClauses.push('threshold = $threshold');
        params.$threshold = changes.threshold ?? null;
      }

      if (changes.operator !== undefined) {
        setClauses.push('operator = $operator');
        params.$operator = changes.operator ?? null;
      }

      if (changes.severity !== undefined) {
        setClauses.push('severity = $severity');
        params.$severity = changes.severity;
      }

      if (setClauses.length === 0) {
        return;
      }

      await database.runAsync(
        `
          UPDATE filter_rules
          SET ${setClauses.join(', ')}
          WHERE id = $id;
        `,
        params
      );
    } catch (error) {
      throw new Error(`Failed to update filter rule with id ${id}: ${getErrorMessage(error)}`);
    }
  }

  async deleteById(id: number): Promise<void> {
    try {
      const database = await this.getDatabase();

      await database.runAsync(
        `
          DELETE FROM filter_rules
          WHERE id = $id;
        `,
        {
          $id: id,
        }
      );
    } catch (error) {
      throw new Error(`Failed to delete filter rule with id ${id}: ${getErrorMessage(error)}`);
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
