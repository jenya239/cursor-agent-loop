import type { CdpPort } from '../cdp/port';
import { managedWindowTitle } from '../cursor/agent-targets';
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
    dismissModals: async () => {
      const all = await cdp.dismissModals();
      return all.filter((d) => managedWindowTitle(d.windowTitle || ''));
    },
    drainQueue,
    observe: async () => {
      const windows = await observeWindows(cdp);
      return windows.filter((w) => managedWindowTitle(w.windowTitle, w.composerId));
    },
    recoverSlow: (windowTitle) => {
      if (!managedWindowTitle(windowTitle)) return Promise.resolve(null);
      return recoverSlowWindow(cdp, windowTitle);
    },
  };
}
