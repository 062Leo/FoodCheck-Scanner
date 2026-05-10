import { debounce } from '../debounce';

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call the function after the delay', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const debounced = debounce(fn, 400);

    const promise = debounced('arg1', 'arg2');

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(400);
    await Promise.resolve();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    await expect(promise).resolves.toBe('result');
  });

  it('should debounce multiple rapid calls and only execute the last', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const debounced = debounce(fn, 400);

    debounced('a');
    jest.advanceTimersByTime(200);
    debounced('b');
    jest.advanceTimersByTime(200);
    const p3 = debounced('c');

    // Only 200ms have passed since last call — fn not yet called
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(400);
    await Promise.resolve();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
    await expect(p3).resolves.toBe('result');

    // Earlier promises are never resolved (silently discarded)
  });

  it('should propagate errors from the wrapped function', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const debounced = debounce(fn, 400);

    const promise = debounced('x');

    jest.advanceTimersByTime(400);
    await Promise.resolve();

    await expect(promise).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use default delay of 400ms when not specified', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const debounced = debounce(fn);

    const promise = debounced();

    jest.advanceTimersByTime(399);
    await Promise.resolve();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
    await expect(promise).resolves.toBe('ok');
  });

  it('should allow separate calls after the first completes', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const debounced = debounce(fn, 400);

    const p1 = debounced('first');
    jest.advanceTimersByTime(400);
    await p1;

    const p2 = debounced('second');
    jest.advanceTimersByTime(400);
    await p2;

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'first');
    expect(fn).toHaveBeenNthCalledWith(2, 'second');
  });

  it('should reset the debounce timer on subsequent calls', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const debounced = debounce(fn, 400);

    debounced('a');
    jest.advanceTimersByTime(300);
    debounced('b');
    jest.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled(); // total 600ms but only 300ms since last call

    jest.advanceTimersByTime(100); // 400ms since 'b'
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });
});
