import type { CdpPort } from '../cdp/port';
import { observeWindows, recoverSlowWindow, type WindowObservation } from './observe';

export interface WatchdogActions {
  dismissModals(): Promise<import('../cdp/port').DismissOutcome[]>;
  drainQueue(): Promise<{ sent: number; remaining: number }>;
  observe(): Promise<WindowObservation[]>;
  recoverSlow(windowTitle: string): Promise<Awaited<ReturnType<typeof recoverSlowWindow>>>;
}

export function createWatchdogActions(
  cdp: CdpPort,
  drainQueue: () => Promise<{ sent: number; remaining: number }>
): WatchdogActions {
  return {
    dismissModals: () => cdp.dismissModals(),
    drainQueue,
    observe: () => observeWindows(cdp),
    recoverSlow: (windowTitle) => recoverSlowWindow(cdp, windowTitle),
  };
}
