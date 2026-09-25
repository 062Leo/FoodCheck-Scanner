/// <reference types="node" />
/**
 * Test double for expo-sqlite backed by a real SQLite engine (node:sqlite).
 * Implements the subset of the async SQLiteDatabase API the app uses, so SQL,
 * constraints and migrations run exactly as they would on the device.
 */

type BindValue = string | number | null | boolean | Uint8Array;
type BindParams = Record<string, BindValue> | BindValue[];

interface NodeStatement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

interface NodeDatabase {
  exec(sql: string): void;
  prepare(sql: string): NodeStatement;
  close(): void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => NodeDatabase;
};

function normalizeParams(params: unknown[]): unknown[] {
  if (params.length === 1 && params[0] !== null && typeof params[0] === 'object') {
    const value = params[0] as BindParams;
    if (Array.isArray(value)) return value.map(toBindable);
    const named: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) named[key] = toBindable(v);
    return [named];
  }
  return params.map(toBindable);
}

function toBindable(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

export class NodeSqliteDatabase {
  readonly native: NodeDatabase;
  private closed = false;

  constructor(path = ':memory:') {
    this.native = new DatabaseSync(path);
  }

  private ensureOpen(): void {
    if (this.closed) throw new Error('Database is closed');
  }

  async execAsync(sql: string): Promise<void> {
    this.ensureOpen();
    this.native.exec(sql);
  }

  async runAsync(
    sql: string,
    ...params: unknown[]
  ): Promise<{ changes: number; lastInsertRowId: number }> {
    this.ensureOpen();
    const result = this.native.prepare(sql).run(...normalizeParams(params));
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    this.ensureOpen();
    const row = this.native.prepare(sql).get(...normalizeParams(params));
    return (row ?? null) as T | null;
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    this.ensureOpen();
    return this.native.prepare(sql).all(...normalizeParams(params)) as T[];
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.ensureOpen();
    this.native.exec('BEGIN');
    try {
      await task();
      this.native.exec('COMMIT');
    } catch (error) {
      this.native.exec('ROLLBACK');
      throw error;
    }
  }

  async withExclusiveTransactionAsync(
    task: (txn: NodeSqliteDatabase) => Promise<void>
  ): Promise<void> {
    this.ensureOpen();
    this.native.exec('BEGIN EXCLUSIVE');
    try {
      await task(this);
      this.native.exec('COMMIT');
    } catch (error) {
      this.native.exec('ROLLBACK');
      throw error;
    }
  }

  async closeAsync(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.native.close();
  }
}
