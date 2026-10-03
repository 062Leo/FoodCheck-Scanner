import { RobotoffClient } from '../RobotoffClient';

global.fetch = jest.fn();

describe('RobotoffClient', () => {
  beforeEach(() => (fetch as jest.Mock).mockReset());

  it('gives up on a stalled connection instead of loading forever', async () => {
    jest.useFakeTimers();
    (fetch as jest.Mock).mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        )
    );

    const insights = new RobotoffClient().getInsights('4000000000001');
    await jest.advanceTimersByTimeAsync(10_000);

    await expect(insights).resolves.toEqual([]);
    jest.useRealTimers();
  });

  it('returns and caches the insights', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'found', insights: [{ id: '1', type: 'category' }] }),
    });
    const client = new RobotoffClient();

    expect(await client.getInsights('4000000000001')).toHaveLength(1);
    expect(await client.getInsights('4000000000001')).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
