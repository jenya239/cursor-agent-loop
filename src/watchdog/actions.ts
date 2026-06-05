import type { CdpPort, DismissOutcome } from '../cdp/port';
import { workbenchPages } from '../cdp/client';
import { liveDismissModalsFromTargets } from '../cdp/dismiss-modals';
import { isFixtureCdp } from '../cdp/fixture-cdp';
import { isManagedObservation, managedWindowTitle, tmuxAgentTargets } from '../cursor/agent-targets';
import { observeWindowsFixture } from '../cdp/fixture-observe';
import { observeWindowsFromTargets, recoverSlowWindow, type WindowObservation } from './observe';
import { observeTmuxTargets } from './tmux-observe';
import type { TmuxRunner } from '../tmux/types';

export interface WatchdogActions {
  dismissModals(): Promise<DismissOutcome[]>;
  drainQueue(): Promise<{ sent: number; remaining: number }>;
  observe(): Promise<WindowObservation[]>;
  recoverSlow(windowTitle: string): Promise<Awaited<ReturnType<typeof recoverSlowWindow>>>;
  /** Single batched tick: one listTargets() → observe + conditional dismiss */
  batchTick(): Promise<{ windows: WindowObservation[]; dismissed: DismissOutcome[] }>;
}

export function createWatchdogActions(
  cdp: CdpPort,
  drainQueue: () => Promise<{ sent: number; remaining: number }>,
  opts?: { dismissEveryN?: number; tmuxRunner?: TmuxRunner }
): WatchdogActions {
  const dismissEveryN = opts?.dismissEveryN ?? 5; // dismiss every ~20s at 4s poll
  let tickCount = 0;

  return {
    dismissModals: async () => {
      const all = await cdp.dismissModals();
      return all.filter((d) => managedWindowTitle(d.windowTitle || ''));
    },
    drainQueue,
    observe: async () => {
      const windows = await (isFixtureCdp(cdp)
        ? observeWindowsFixture(cdp)
        : observeWindowsFromTargets(await cdp.listTargets()));
      return windows.filter((window) => isManagedObservation(window));
    },
    recoverSlow: (windowTitle) => {
      if (windowTitle.startsWith('tmux:')) return Promise.resolve(null);
      if (!managedWindowTitle(windowTitle)) return Promise.resolve(null);
      return recoverSlowWindow(cdp, windowTitle);
    },
    batchTick: async () => {
      tickCount++;
      const tmuxWindows = observeTmuxTargets(tmuxAgentTargets(), { runner: opts?.tmuxRunner });

      let targets: Awaited<ReturnType<typeof cdp.listTargets>> = [];
      let cdpWindows: WindowObservation[] = [];

      if (await cdp.isAvailable()) {
        if (isFixtureCdp(cdp)) {
          cdpWindows = (await observeWindowsFixture(cdp)).filter((window) => isManagedObservation(window));
        } else {
          targets = await cdp.listTargets();
          cdpWindows = (await observeWindowsFromTargets(targets)).filter((window) => isManagedObservation(window));
        }
      }

      const windows = [...cdpWindows, ...tmuxWindows];

      // Dismiss modals every N ticks (not every tick) unless a modal was recently seen
      const shouldDismiss = tickCount % dismissEveryN === 0;
      let dismissed: DismissOutcome[] = [];
      if (shouldDismiss && !isFixtureCdp(cdp)) {
        dismissed = (await liveDismissModalsFromTargets(workbenchPages(targets))).filter(
          (d) => managedWindowTitle(d.windowTitle || '')
        );
      } else if (isFixtureCdp(cdp) && shouldDismiss) {
        dismissed = (await cdp.dismissModals()).filter((d) =>
          managedWindowTitle(d.windowTitle || '')
        );
      }

      return { windows, dismissed };
    },
  };
}
