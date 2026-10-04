import type { Recall } from '../../domain/recalls/recall';
import { RecallSourceError } from '../../infrastructure/api/RecallClient';
import {
  HIDE_AFTER_MS,
  isRecallSourceVisible,
  parseRecallState,
  RecallService,
  REFRESH_INTERVAL_MS,
  RETRY_AFTER_FAILURE_MS,
} from '../RecallService';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const HOUR = 60 * 60 * 1000;
const RECALL: Recall = {
  id: 'r1',
  title: 'Beispiel',
  productName: null,
  brand: null,
  manufacturer: null,
  reason: null,
  publishedAt: 0,
  link: 'https://www.lebensmittelwarnung.de/x.html',
  imageUrl: null,
  states: [],
  eans: [],
};

function setup(online = true) {
  let now = Date.UTC(2026, 9, 4);
  let stored: string | null = null;
  const fetchRecalls = jest.fn<Promise<Recall[]>, []>();
  const service = () =>
    new RecallService({
      fetchRecalls,
      isOnline: async () => online,
      readState: async () => stored,
      writeState: async (json) => {
        stored = json;
      },
      now: () => now,
    });
  return {
    fetchRecalls,
    service,
    advance: (ms: number) => (now += ms),
    now: () => now,
  };
}

describe('RecallService', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('caches the warnings and refreshes at most every few hours', async () => {
    const env = setup();
    env.fetchRecalls.mockResolvedValue([RECALL]);
    const service = env.service();

    const state = await service.refreshIfDue();
    expect(isRecallSourceVisible(state, env.now())).toBe(true);
    expect(state.recalls).toEqual([RECALL]);

    env.advance(REFRESH_INTERVAL_MS - 1);
    await service.refreshIfDue();
    expect(env.fetchRecalls).toHaveBeenCalledTimes(1);

    // A new start reads the cache from the database.
    expect((await env.service().getState()).recalls).toEqual([RECALL]);

    env.advance(1);
    await service.refreshIfDue();
    expect(env.fetchRecalls).toHaveBeenCalledTimes(2);
  });

  it('does not ask the source while offline', async () => {
    const env = setup(false);
    await env.service().refreshIfDue();
    expect(env.fetchRecalls).not.toHaveBeenCalled();
  });

  it('keeps the cache after a failure, retries after a day and hides it after a week', async () => {
    const env = setup();
    env.fetchRecalls.mockResolvedValueOnce([RECALL]);
    const service = env.service();
    await service.refreshIfDue();

    env.fetchRecalls.mockRejectedValue(new RecallSourceError('failure', 'HTTP 500'));
    env.advance(REFRESH_INTERVAL_MS);
    let state = await service.refreshIfDue();
    expect(isRecallSourceVisible(state, env.now())).toBe(true);
    expect(env.fetchRecalls).toHaveBeenCalledTimes(2);

    env.advance(RETRY_AFTER_FAILURE_MS - HOUR);
    await service.refreshIfDue();
    expect(env.fetchRecalls).toHaveBeenCalledTimes(2);

    while (env.now() - (state.lastSuccessAt ?? 0) < HIDE_AFTER_MS) {
      env.advance(RETRY_AFTER_FAILURE_MS);
      state = await service.refreshIfDue();
    }
    expect(isRecallSourceVisible(state, env.now())).toBe(false);
    expect(state.recalls).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('hides everything at once when the source answers in an unknown form', async () => {
    const env = setup();
    env.fetchRecalls.mockResolvedValueOnce([RECALL]);
    const service = env.service();
    await service.refreshIfDue();

    env.fetchRecalls.mockRejectedValueOnce(new RecallSourceError('shape', 'no docs'));
    env.advance(REFRESH_INTERVAL_MS);
    const broken = await service.refreshIfDue();
    expect(isRecallSourceVisible(broken, env.now())).toBe(false);

    env.fetchRecalls.mockResolvedValueOnce([RECALL]);
    env.advance(RETRY_AFTER_FAILURE_MS);
    const repaired = await service.refreshIfDue();
    expect(isRecallSourceVisible(repaired, env.now())).toBe(true);
  });

  it('never throws, not even when the cache cannot be stored', async () => {
    const service = new RecallService({
      fetchRecalls: async () => [RECALL],
      isOnline: async () => true,
      readState: async () => {
        throw new Error('no database');
      },
      writeState: async () => {
        throw new Error('disk full');
      },
    });
    await expect(service.refreshIfDue()).resolves.toMatchObject({ recalls: [RECALL] });
  });

  it('treats an unreadable cache as empty', () => {
    expect(parseRecallState('{kaputt').lastSuccessAt).toBeNull();
    expect(parseRecallState(JSON.stringify({ recalls: 'x' })).recalls).toEqual([]);
  });
});
