import type { WatchdogActions } from './actions';
import type { WatchdogStats } from './stats';
import { SlowTracker } from './slow-tracker';
import { slowWindowsDue, watchdogSlowMs, watchdogSlowRecoverEnabled } from './slow-recover';

export interface DaemonControl {
  tick(): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
}

export interface DaemonOpts {
  actions: WatchdogActions;
  stats: WatchdogStats;
  pollMs: number;
  slowTracker?: SlowTracker;
  slowMs?: number;
  slowRecover?: boolean;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export function startDaemon(opts: DaemonOpts): DaemonControl {
  const { actions, stats, pollMs } = opts;
  const setIv = opts.setIntervalFn ?? setInterval;
  const clearIv = opts.clearIntervalFn ?? clearInterval;
  const tracker = opts.slowTracker ?? new SlowTracker();
  const slowMs = opts.slowMs ?? watchdogSlowMs();
  const slowRecover = opts.slowRecover ?? watchdogSlowRecoverEnabled();
  let timer: ReturnType<typeof setInterval> | null = null;

  async function tick(): Promise<void> {
    if (stats.snapshot().paused) return;
    stats.recordPoll();
    try {
      const windows = await actions.observe();
      stats.recordObserve(
        windows.map((w) => ({
          windowTitle: w.windowTitle,
          composerId: w.composerId,
          model: w.model,
          busy: w.busy,
          slowCount: w.slowCount,
          draftLen: w.draftLen,
          draftHasToken: w.draftHasToken,
        })),
        { busy: windows.filter((w) => w.busy).length, slow: windows.filter((w) => w.slowCount > 0).length }
      );

      const dismissed = await actions.dismissModals();
      for (const d of dismissed) {
        if (d.open) stats.recordDismiss(d.kind, { action: d.action, btn: d.btn, window: d.windowTitle });
      }

      if (slowRecover) {
        for (const title of slowWindowsDue(windows, tracker, slowMs)) {
          const r = await actions.recoverSlow(title);
          if (r) {
            stats.recordSlowRecover(title, { ...r.outcome });
            tracker.clear(title);
          }
        }
      }

      const drain = await actions.drainQueue();
      stats.recordDrain(drain.sent);
    } catch (e) {
      stats.recordError(e instanceof Error ? e.message : String(e));
    }
  }

  function startInterval(): void {
    if (timer) clearIv(timer);
    timer = setIv(() => void tick(), pollMs);
  }

  startInterval();

  return {
    tick,
    pause() {
      stats.setPaused(true);
    },
    resume() {
      stats.setPaused(false);
    },
    stop() {
      if (timer) clearIv(timer);
      timer = null;
    },
  };
}
