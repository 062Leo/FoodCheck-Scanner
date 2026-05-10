const MIN_DELAY_MS = 400;

export function debounce<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
  delayMs: number = MIN_DELAY_MS
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    if (timer) {
      clearTimeout(timer);
    }

    return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
      timer = setTimeout(async () => {
        timer = null;

        try {
          const result = await fn(...args);
          resolve(result as Awaited<ReturnType<T>>);
        } catch (error) {
          reject(error);
        }
      }, delayMs);
    });
  };
}
