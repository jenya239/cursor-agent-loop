export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollUntil<T>(
  fn: () => Promise<T>,
  ok: (value: T) => boolean,
  opts: { intervalMs: number; timeoutMs: number }
): Promise<{ value: T; attempts: number; elapsedMs: number; matched: boolean }> {
  const t0 = Date.now();
  let attempts = 0;
  let last: T;
  while (Date.now() - t0 < opts.timeoutMs) {
    attempts++;
    last = await fn();
    if (ok(last)) {
      return { value: last, attempts, elapsedMs: Date.now() - t0, matched: true };
    }
    await sleep(opts.intervalMs);
  }
  return { value: last!, attempts, elapsedMs: Date.now() - t0, matched: false };
}
