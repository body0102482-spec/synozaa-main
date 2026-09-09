/** Run `fn` at most once per `waitMs`; rapid calls share one scheduled run. */
export function debounce<T extends (...args: never[]) => void>(fn: T, waitMs: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  }) as T;
}
