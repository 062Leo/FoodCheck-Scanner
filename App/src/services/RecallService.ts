import type { Recall } from '../domain/recalls/recall';
import { fetchRecalls, RecallSourceError } from '../infrastructure/api/RecallClient';
import { getMetaValue, setMetaValue } from '../infrastructure/db/DatabaseService';
import { isOnline } from '../infrastructure/network/connectivity';

/** Meta key of the cached warnings and the health of the source. */
export const META_RECALLS = 'recalls_state';

const HOUR_MS = 60 * 60 * 1000;
/** A working source is asked again after this time at the earliest. */
export const REFRESH_INTERVAL_MS = 6 * HOUR_MS;
/** After a failure the source is left alone for a day. */
export const RETRY_AFTER_FAILURE_MS = 24 * HOUR_MS;
/** Cached warnings are shown at most this long after the last successful refresh. */
export const HIDE_AFTER_MS = 7 * 24 * HOUR_MS;

export interface RecallState {
  recalls: Recall[];
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
  /** Start of the current series of failures, null while the source works. */
  failingSince: number | null;
  /** The source answered in an unexpected form: hide at once until it works again. */
  shapeBroken: boolean;
}

export const EMPTY_RECALL_STATE: RecallState = {
  recalls: [],
  lastSuccessAt: null,
  lastAttemptAt: null,
  failingSince: null,
  shapeBroken: false,
};

/** Whether the app shows anything about recalls. */
export function isRecallSourceVisible(state: RecallState, now: number): boolean {
  return (
    !state.shapeBroken && state.lastSuccessAt !== null && now - state.lastSuccessAt < HIDE_AFTER_MS
  );
}

export function isRefreshDue(state: RecallState, now: number): boolean {
  if (state.lastAttemptAt === null) return true;
  const wait = state.failingSince === null ? REFRESH_INTERVAL_MS : RETRY_AFTER_FAILURE_MS;
  return now - state.lastAttemptAt >= wait;
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

/** The stored state, or the empty state when it is missing or unreadable. */
export function parseRecallState(json: string | null): RecallState {
  if (!json) return EMPTY_RECALL_STATE;
  try {
    const data = JSON.parse(json) as Partial<RecallState>;
    if (
      !Array.isArray(data.recalls) ||
      !isNumberOrNull(data.lastSuccessAt) ||
      !isNumberOrNull(data.lastAttemptAt) ||
      !isNumberOrNull(data.failingSince) ||
      typeof data.shapeBroken !== 'boolean'
    ) {
      return EMPTY_RECALL_STATE;
    }
    return data as RecallState;
  } catch {
    return EMPTY_RECALL_STATE;
  }
}

function devWarning(message: string): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn(`[recalls] ${message}`);
}

export interface RecallServiceDeps {
  fetchRecalls: () => Promise<Recall[]>;
  isOnline: () => Promise<boolean>;
  readState: () => Promise<string | null>;
  writeState: (json: string) => Promise<void>;
  now: () => number;
}

const defaultDeps: RecallServiceDeps = {
  fetchRecalls: () => fetchRecalls(),
  isOnline,
  readState: () => getMetaValue(META_RECALLS),
  writeState: (json) => setMetaValue(META_RECALLS, json),
  now: () => Date.now(),
};

/**
 * Warnings from lebensmittelwarnung.de, cached in the database. The feed can fail or
 * change: every failure is silent (only a warning in development), the next attempt waits a day,
 * and when the source keeps failing for a week or answers in an unknown form, nothing
 * about recalls is shown. No method throws.
 */
export class RecallService {
  private readonly deps: RecallServiceDeps;
  private state: RecallState | null = null;
  private refreshing: Promise<RecallState> | null = null;

  constructor(deps: Partial<RecallServiceDeps> = {}) {
    this.deps = { ...defaultDeps, ...deps };
  }

  async getState(): Promise<RecallState> {
    if (this.state) return this.state;
    try {
      this.state = parseRecallState(await this.deps.readState());
    } catch (error) {
      devWarning(`cache could not be read: ${String(error)}`);
      this.state = EMPTY_RECALL_STATE;
    }
    return this.state;
  }

  /** Asks the source when a refresh is due and the device is online; otherwise the cache. */
  refreshIfDue(): Promise<RecallState> {
    this.refreshing ??= this.refresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async refresh(): Promise<RecallState> {
    const current = await this.getState();
    const now = this.deps.now();
    if (!isRefreshDue(current, now)) return current;
    const online = await this.deps.isOnline().catch(() => false);
    if (!online) return current;

    let next: RecallState;
    try {
      const recalls = await this.deps.fetchRecalls();
      next = {
        recalls,
        lastSuccessAt: now,
        lastAttemptAt: now,
        failingSince: null,
        shapeBroken: false,
      };
    } catch (error) {
      devWarning(`source unavailable: ${error instanceof Error ? error.message : String(error)}`);
      const shapeBroken = error instanceof RecallSourceError && error.kind === 'shape';
      next = {
        ...current,
        lastAttemptAt: now,
        failingSince: current.failingSince ?? now,
        shapeBroken,
      };
      // Keep no data that can no longer be shown.
      if (!isRecallSourceVisible(next, now)) next = { ...next, recalls: [] };
    }

    this.state = next;
    try {
      await this.deps.writeState(JSON.stringify(next));
    } catch (error) {
      devWarning(`cache could not be written: ${String(error)}`);
    }
    return next;
  }
}

export const recallService = new RecallService();
