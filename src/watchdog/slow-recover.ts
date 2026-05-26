import type { WindowObservation } from './observe';
import { SlowTracker } from './slow-tracker';

export function slowWindowsDue(
  windows: WindowObservation[],
  tracker: SlowTracker,
  slowMs: number,
  now = Date.now()
): string[] {
  const due: string[] = [];
  for (const w of windows) {
    if (!w.busy || w.slowCount <= 0) {
      tracker.clear(w.windowTitle);
      continue;
    }
    const age = tracker.note(w.windowTitle, w.slowCount, now);
    if (age != null && age >= slowMs) due.push(w.windowTitle);
  }
  return due;
}

export function watchdogSlowMs(): number {
  return Number(process.env.CR_WATCHDOG_SLOW_MS) || 90_000;
}

export function watchdogSlowRecoverEnabled(): boolean {
  return process.env.CR_WATCHDOG_SLOW_RECOVER == null || process.env.CR_WATCHDOG_SLOW_RECOVER === '1';
}
