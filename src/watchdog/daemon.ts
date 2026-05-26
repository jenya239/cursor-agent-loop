import type { WatchdogActions } from './actions';
import type { WatchdogStats } from './stats';

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
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export function startDaemon(opts: DaemonOpts): DaemonControl {
  const { actions, stats, pollMs } = opts;
  const setIv = opts.setIntervalFn ?? setInterval;
  const clearIv = opts.clearIntervalFn ?? clearInterval;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function tick(): Promise<void> {
    if (stats.snapshot().paused) return;
    stats.recordPoll();
    try {
      const dismissed = await actions.dismissModals();
      for (const d of dismissed) {
        if (d.open) stats.recordDismiss(d.kind, { action: d.action, btn: d.btn, window: d.windowTitle });
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
