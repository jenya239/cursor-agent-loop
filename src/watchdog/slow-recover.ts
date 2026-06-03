import type { WindowObservation } from './observe';
import { StuckTracker } from './stuck-tracker';

export function hasReconnectIndicator(w: WindowObservation): boolean {
  return !!w.reconnecting;
}

export function hasSlowIndicator(w: WindowObservation): boolean {
  return w.slowCount > 0 || w.pairs.some((p) => p.slow);
}

export function stuckWindowsDue(
  windows: WindowObservation[],
  tracker: StuckTracker,
  opts: { slowMs: number; busyMs: number; reconnectMs: number },
  now = Date.now()
): string[] {
  const due: string[] = [];
  for (const w of windows) {
    if (!w.busy) {
      tracker.clear(w.windowTitle);
      continue;
    }
    const age = tracker.noteBusy(w.windowTitle, now);
    const limit = hasReconnectIndicator(w)
      ? opts.reconnectMs
      : hasSlowIndicator(w)
        ? opts.slowMs
        : opts.busyMs;
    if (age >= limit) due.push(w.windowTitle);
  }
  return due;
}

/** @deprecated use stuckWindowsDue */
export function slowWindowsDue(
  windows: WindowObservation[],
  tracker: StuckTracker,
  slowMs: number,
  now = Date.now()
): string[] {
  return stuckWindowsDue(windows, tracker, { slowMs, busyMs: Number.MAX_SAFE_INTEGER, reconnectMs: reconnectMs() }, now);
}

export function watchdogReconnectMs(): number {
  return Number(process.env.CR_WATCHDOG_RECONNECT_MS) || 120_000;
}

function reconnectMs(): number {
  return watchdogReconnectMs();
}

export function watchdogSlowMs(): number {
  return Number(process.env.CR_WATCHDOG_SLOW_MS) || 90_000;
}

export function watchdogBusyMs(): number {
  return Number(process.env.CR_WATCHDOG_BUSY_MS) || 600_000;
}

export function watchdogSlowRecoverEnabled(): boolean {
  return process.env.CR_WATCHDOG_SLOW_RECOVER == null || process.env.CR_WATCHDOG_SLOW_RECOVER === '1';
}
