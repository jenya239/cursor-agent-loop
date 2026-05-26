import type { CdpPort } from '../cdp/port';

export interface WatchdogActions {
  dismissModals(): Promise<import('../cdp/port').DismissOutcome[]>;
  drainQueue(): Promise<{ sent: number; remaining: number }>;
}

export function createWatchdogActions(
  cdp: CdpPort,
  drainQueue: () => Promise<{ sent: number; remaining: number }>
): WatchdogActions {
  return {
    dismissModals: () => cdp.dismissModals(),
    drainQueue,
  };
}
