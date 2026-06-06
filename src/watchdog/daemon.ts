import type { WatchdogActions } from './actions';
import type { WatchdogStats } from './stats';
import { StuckTracker } from './stuck-tracker';
import { stuckWindowsDue, watchdogBusyMs, watchdogReconnectMs, watchdogSlowMs, watchdogSlowRecoverEnabled } from './slow-recover';
import { noteAgentRecover, targetForWindowTitle } from '../cursor/agent-state';

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
  idlePollMs?: number;
  idleAfterTicks?: number;
  slowTracker?: StuckTracker;
  slowMs?: number;
  busyMs?: number;
  reconnectMs?: number;
  slowRecover?: boolean;
  // Auto-stop after this many ms of continuous send failures (default 12 min)
  sendFailStopMs?: number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export function startDaemon(opts: DaemonOpts): DaemonControl {
  const { actions, stats, pollMs } = opts;
  const setIv = opts.setIntervalFn ?? setInterval;
  const clearIv = opts.clearIntervalFn ?? clearInterval;
  const tracker = opts.slowTracker ?? new StuckTracker();
  const slowMs = opts.slowMs ?? watchdogSlowMs();
  const busyMs = opts.busyMs ?? watchdogBusyMs();
  const reconnectMs = opts.reconnectMs ?? watchdogReconnectMs();
  const slowRecover = opts.slowRecover ?? watchdogSlowRecoverEnabled();
  const sendFailStopMs = opts.sendFailStopMs ?? (Number(process.env.CR_SEND_FAIL_STOP_MS) || 12 * 60_000);
  // sendFailSince: per-window timestamp of first send-fail in current continuous run
  const sendFailSince = new Map<string, number>();
  // Adaptive interval: after N consecutive idle ticks, stretch to idlePollMs
  const idlePollMs = opts.idlePollMs ?? (Number(process.env.CR_WATCHDOG_IDLE_POLL_MS) || Math.min(pollMs * 5, 20000));
  const idleAfterTicks = opts.idleAfterTicks ?? 3;
  let consecutiveIdle = 0;
  let currentPollMs = pollMs;
  let timer: ReturnType<typeof setInterval> | null = null;

  function restartInterval(ms: number): void {
    if (timer) clearIv(timer);
    timer = setIv(() => void tick(), ms);
  }

  function setAdaptiveInterval(isIdle: boolean): void {
    if (isIdle) {
      consecutiveIdle++;
      if (consecutiveIdle >= idleAfterTicks && currentPollMs !== idlePollMs) {
        currentPollMs = idlePollMs;
        restartInterval(currentPollMs);
      }
    } else {
      consecutiveIdle = 0;
      if (currentPollMs !== pollMs) {
        currentPollMs = pollMs;
        restartInterval(currentPollMs);
      }
    }
  }

  async function tick(): Promise<void> {
    if (stats.snapshot().paused) return;
    stats.decayErrors();
    stats.recordPoll();
    try {
      // Single batched CDP call: one listTargets() → observe + conditional dismiss
      const { windows, dismissed } = await actions.batchTick();

      stats.recordObserve(
        windows.map((w) => ({
          windowTitle: w.windowTitle,
          composerId: w.composerId,
          model: w.model,
          busy: w.busy,
          reconnecting: w.reconnecting,
          slowCount: w.slowCount,
          draftLen: w.draftLen,
          draftHasToken: w.draftHasToken,
        })),
        { busy: windows.filter((w) => w.busy).length, slow: windows.filter((w) => w.slowCount > 0).length }
      );

      for (const d of dismissed) {
        if (d.open) stats.recordDismiss(d.kind, { action: d.action, btn: d.btn, window: d.windowTitle });
      }

      if (slowRecover) {
        for (const title of stuckWindowsDue(windows, tracker, { slowMs, busyMs, reconnectMs })) {
          const r = await actions.recoverSlow(title);
          if (r) {
            stats.recordSlowRecover(title, { ...r.outcome });
            const t = targetForWindowTitle(title);
            if (t) {
              noteAgentRecover(
                t.id,
                r.outcome.resent ? 'stop+resubmit' : r.outcome.submitted ? 'resubmit' : 'stop'
              );
            }
            tracker.clear(title);
          }
        }
      }

      const drain = await actions.drainQueue();
      stats.recordDrain(drain.sent);

      // Auto-stop: window busy + queue non-empty for > sendFailStopMs → force stop
      for (const w of windows) {
        const hasPending = drain.remaining > 0;
        if (w.busy && hasPending) {
          if (!sendFailSince.has(w.windowTitle)) sendFailSince.set(w.windowTitle, Date.now());
          const since = sendFailSince.get(w.windowTitle)!;
          if (Date.now() - since >= sendFailStopMs) {
            const r = await actions.recoverSlow(w.windowTitle);
            sendFailSince.delete(w.windowTitle);
            if (r) {
              const t = targetForWindowTitle(w.windowTitle);
              if (t) noteAgentRecover(t.id, 'stop+resubmit');
              stats.recordSlowRecover(w.windowTitle, { ...r.outcome });
              tracker.clear(w.windowTitle);
            }
          }
        } else {
          sendFailSince.delete(w.windowTitle);
        }
      }

      // Adaptive: idle when no busy windows, no dismissed modals, no drain
      const isIdle = windows.every((w) => !w.busy && !w.reconnecting) &&
        dismissed.filter((d) => d.open).length === 0 &&
        drain.sent === 0;
      setAdaptiveInterval(isIdle);
    } catch (e) {
      stats.recordError(e instanceof Error ? e.message : String(e));
      setAdaptiveInterval(false);
    }
  }

  restartInterval(currentPollMs);

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
