import { REFRESH_INTERVAL_MS, StoredProductRefreshService } from '../StoredProductRefreshService';
import { NetworkError } from '../../infrastructure/api/fetchWithTimeout';
import { ApiError } from '../../infrastructure/api/ApiError';
import { SEEDED_RULES } from '../../domain/analysis/__fixtures__/goldenRuleSets';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

describe('StoredProductRefreshService', () => {
  let repository: { findEansWithDataVersionBelow: jest.Mock };
  let lookup: { refreshStored: jest.Mock };
  let online: boolean;
  let service: StoredProductRefreshService;

  beforeEach(() => {
    jest.useFakeTimers();
    repository = { findEansWithDataVersionBelow: jest.fn().mockResolvedValue(['1', '2', '3']) };
    lookup = { refreshStored: jest.fn().mockResolvedValue(true) };
    online = true;
    service = new StoredProductRefreshService({
      repository,
      lookup,
      isOnline: async () => online,
    });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('asks for the products with an older data version, one at a time', async () => {
    const onRefreshed = jest.fn();
    const done = service.start(() => SEEDED_RULES, onRefreshed);

    await jest.advanceTimersByTimeAsync(0);
    expect(repository.findEansWithDataVersionBelow).toHaveBeenCalledWith(2);
    expect(lookup.refreshStored).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS);
    expect(lookup.refreshStored).toHaveBeenCalledTimes(1);
    expect(lookup.refreshStored).toHaveBeenLastCalledWith('1', SEEDED_RULES);

    await jest.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS - 1);
    expect(lookup.refreshStored).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2 * REFRESH_INTERVAL_MS);
    await expect(done).resolves.toBe(3);
    expect(onRefreshed.mock.calls).toEqual([['1'], ['2'], ['3']]);
  });

  it('stays within ten product requests per minute', async () => {
    repository.findEansWithDataVersionBelow.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => String(i))
    );
    void service.start(() => SEEDED_RULES);

    await jest.advanceTimersByTimeAsync(60_000);

    expect(lookup.refreshStored.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it('stops when the device goes offline', async () => {
    const done = service.start(() => SEEDED_RULES);

    await jest.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS);
    online = false;
    await jest.advanceTimersByTimeAsync(5 * REFRESH_INTERVAL_MS);

    await expect(done).resolves.toBe(1);
    expect(lookup.refreshStored).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a rate limit', ApiError.fromHttpStatus(429)],
    ['a timeout', new NetworkError('timeout', 'timeout')],
  ])('stops at %s and leaves the rest for the next start', async (_, error) => {
    lookup.refreshStored.mockResolvedValueOnce(true).mockRejectedValueOnce(error);
    const done = service.start(() => SEEDED_RULES);

    await jest.advanceTimersByTimeAsync(5 * REFRESH_INTERVAL_MS);

    await expect(done).resolves.toBe(1);
    expect(lookup.refreshStored).toHaveBeenCalledTimes(2);
  });

  it('runs only once at a time and can run again afterwards', async () => {
    const first = service.start(() => SEEDED_RULES);
    const second = service.start(() => SEEDED_RULES);
    expect(second).toBe(first);

    await jest.advanceTimersByTimeAsync(3 * REFRESH_INTERVAL_MS);
    await first;
    expect(repository.findEansWithDataVersionBelow).toHaveBeenCalledTimes(1);

    repository.findEansWithDataVersionBelow.mockResolvedValue([]);
    await expect(service.start(() => SEEDED_RULES)).resolves.toBe(0);
    expect(repository.findEansWithDataVersionBelow).toHaveBeenCalledTimes(2);
  });

  it('uses the rules current at each product', async () => {
    let rules = SEEDED_RULES;
    void service.start(() => rules);

    await jest.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS);
    rules = SEEDED_RULES.slice(1);
    await jest.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS);

    expect(lookup.refreshStored.mock.calls[1][1]).toBe(rules);
  });
});
