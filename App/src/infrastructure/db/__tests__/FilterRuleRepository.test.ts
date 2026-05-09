import * as SQLite from 'expo-sqlite';

import { FilterRuleRepository } from '../FilterRuleRepository';
import type { FilterRule, NewFilterRule } from '../../../types/FilterRule';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

type DbState = {
  records: Map<number, FilterRule>;
  nextId: number;
};

type MockDatabase = {
  execAsync: jest.Mock<Promise<void>, [string]>;
  getFirstAsync: jest.Mock<Promise<unknown>, [string, ...unknown[]]>;
  getAllAsync: jest.Mock<Promise<unknown[]>, [string, ...unknown[]]>;
  runAsync: jest.Mock<Promise<{ changes: number; lastInsertRowId: number }>, [string, ...unknown[]]>;
};

const openDatabaseAsync = SQLite.openDatabaseAsync as jest.MockedFunction<typeof SQLite.openDatabaseAsync>;

describe('FilterRuleRepository', () => {
  let repository: FilterRuleRepository;
  let state: DbState;
  let database: MockDatabase;

  beforeEach(() => {
    state = {
      records: new Map<number, FilterRule>(),
      nextId: 1,
    };

    database = {
      execAsync: jest.fn(async () => undefined),
      getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => handleGetFirst(sql, params, state)),
      getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => handleGetAll(sql, params, state)),
      runAsync: jest.fn(async (sql: string, ...params: unknown[]) => handleRun(sql, params, state)),
    };

    openDatabaseAsync.mockResolvedValue(database as unknown as SQLite.SQLiteDatabase);
    repository = new FilterRuleRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('insert then findAll includes the new rule', async () => {
    const rule: NewFilterRule = {
      type: 'ingredient',
      key: 'Palmöl',
      threshold: null,
      operator: null,
      severity: 'red_flag',
      created_at: '2026-05-09T10:00:00.000Z',
    };

    await repository.insert(rule);

    const rules = await repository.findAll();

    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      type: 'ingredient',
      key: 'Palmöl',
      severity: 'red_flag',
    });
  });

  it('update changes the severity', async () => {
    const rule: NewFilterRule = {
      type: 'ingredient',
      key: 'Zucker',
      threshold: null,
      operator: null,
      severity: 'red_flag',
      created_at: '2026-05-09T10:00:00.000Z',
    };

    await repository.insert(rule);
    const inserted = (await repository.findAll())[0];

    await repository.update(inserted.id, { severity: 'ok' });

    const updated = (await repository.findAll())[0];

    expect(updated.severity).toBe('ok');
  });

  it('deleteById removes the rule', async () => {
    const rule: NewFilterRule = {
      type: 'nutrient',
      key: 'Natrium',
      threshold: 300,
      operator: 'gt',
      severity: 'red_flag',
      created_at: '2026-05-09T10:00:00.000Z',
    };

    await repository.insert(rule);
    const inserted = (await repository.findAll())[0];

    await repository.deleteById(inserted.id);

    const remaining = await repository.findAll();

    expect(remaining).toHaveLength(0);
  });
});

function handleGetFirst(sql: string, params: unknown[], state: DbState): unknown {
  const normalizedSql = normalizeSql(sql);

  if (normalizedSql.includes('FROM meta')) {
    return { value: '2' };
  }

  return null;
}

function handleGetAll(sql: string, _params: unknown[], state: DbState): unknown[] {
  const normalizedSql = normalizeSql(sql);

  if (!normalizedSql.includes('FROM filter_rules')) {
    return [];
  }

  return Array.from(state.records.values()).sort((left, right) => {
    const dateComparison = left.created_at.localeCompare(right.created_at);
    if (dateComparison !== 0) {
      return dateComparison;
    }

    return left.id - right.id;
  });
}

function handleRun(sql: string, params: unknown[], state: DbState): { changes: number; lastInsertRowId: number } {
  const normalizedSql = normalizeSql(sql);

  if (normalizedSql.includes('INSERT INTO filter_rules')) {
    const values = getNamedParams(params[0]);
    const key = getStringValue(values['$key'], 'key');
    const type = getStringValue(values['$type'], 'type');
    const severity = getStringValue(values['$severity'], 'severity');
    const createdAt = getStringValue(values['$created_at'], 'created_at');

    const rule: FilterRule = {
      id: state.nextId++,
      type: type as 'ingredient' | 'nutrient',
      key,
      threshold: values['$threshold'] === null ? null : (values['$threshold'] as number | null),
      operator: values['$operator'] === null ? null : (values['$operator'] as string | null),
      severity: severity as 'red_flag' | 'ok',
      created_at: createdAt,
    };

    state.records.set(rule.id, rule);

    return {
      changes: 1,
      lastInsertRowId: rule.id,
    };
  }

  if (normalizedSql.includes('UPDATE filter_rules')) {
    const values = getNamedParams(params[0]);
    const id = getNumberValue(values['$id'], 'id');

    const existing = state.records.get(id);
    if (!existing) {
      return {
        changes: 0,
        lastInsertRowId: 0,
      };
    }

    const updated: FilterRule = {
      id: existing.id,
      type: values['$type'] !== undefined ? (values['$type'] as FilterRule['type']) : existing.type,
      key: values['$key'] !== undefined ? (values['$key'] as string) : existing.key,
      threshold: values['$threshold'] !== undefined ? (values['$threshold'] as number | null) : existing.threshold,
      operator: values['$operator'] !== undefined ? (values['$operator'] as string | null) : existing.operator,
      severity: values['$severity'] !== undefined ? (values['$severity'] as FilterRule['severity']) : existing.severity,
      created_at: existing.created_at,
    };

    state.records.set(id, updated);

    return {
      changes: 1,
      lastInsertRowId: id,
    };
  }

  if (normalizedSql.includes('DELETE FROM filter_rules')) {
    const values = getNamedParams(params[0]);
    const id = getNumberValue(values['$id'], 'id');

    if (state.records.has(id)) {
      state.records.delete(id);
      return {
        changes: 1,
        lastInsertRowId: 0,
      };
    }

    return {
      changes: 0,
      lastInsertRowId: 0,
    };
  }

  return {
    changes: 0,
    lastInsertRowId: 0,
  };
}

function getNamedParams(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return {};
}

function getStringValue(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected a string value for ${fieldName}.`);
  }

  return value;
}

function getNumberValue(value: unknown, fieldName: string): number {
  if (typeof value !== 'number') {
    throw new Error(`Expected a number value for ${fieldName}.`);
  }

  return value;
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}
