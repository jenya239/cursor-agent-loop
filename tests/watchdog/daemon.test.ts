import { startDaemon } from '../../src/watchdog/daemon';
import { WatchdogStats } from '../../src/watchdog/stats';
import type { WatchdogActions } from '../../src/watchdog/actions';
import { StuckTracker } from '../../src/watchdog/stuck-tracker';

function actions(partial?: Partial<WatchdogActions>): WatchdogActions {
  return {
    dismissModals: async () => [],
    drainQueue: async () => ({ sent: 0, remaining: 0 }),
    observe: async () => [],
    recoverSlow: async () => null,
    ...partial,
  };
}

describe('startDaemon', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs tick on interval', async () => {
    const stats = new WatchdogStats(0);
    const dismissModals = jest.fn().mockResolvedValue([]);
    const drainQueue = jest.fn().mockResolvedValue({ sent: 0, remaining: 0 });
    const observe = jest.fn().mockResolvedValue([]);

    const { tick } = startDaemon({ actions: actions({ dismissModals, drainQueue, observe }), stats, pollMs: 1000 });
    await tick();
    expect(stats.snapshot().polls_total).toBe(1);
    expect(observe).toHaveBeenCalledTimes(1);
    expect(dismissModals).toHaveBeenCalledTimes(1);
    expect(drainQueue).toHaveBeenCalledTimes(1);
  });

  it('records dismiss and drain', async () => {
    const stats = new WatchdogStats(0);
    const actionSet = actions({
      dismissModals: async () => [{ kind: 'pretty_dialog', open: true, action: 'cancel' }],
      drainQueue: async () => ({ sent: 3, remaining: 0 }),
    });
    const { tick } = startDaemon({ actions: actionSet, stats, pollMs: 1000 });
    await tick();
    expect(stats.snapshot().modals_dismissed.pretty_dialog).toBe(1);
    expect(stats.snapshot().drain_sent_total).toBe(3);
  });

  it('skips tick when paused', async () => {
    const stats = new WatchdogStats(0);
    stats.setPaused(true);
    const dismissModals = jest.fn();
    const { tick } = startDaemon({
      actions: actions({ dismissModals }),
      stats,
      pollMs: 1000,
    });
    await tick();
    expect(dismissModals).not.toHaveBeenCalled();
  });

  it('records errors', async () => {
    const stats = new WatchdogStats(0);
    const actionSet = actions({
      dismissModals: async () => {
        throw new Error('cdp down');
      },
    });
    const { tick } = startDaemon({ actions: actionSet, stats, pollMs: 1000 });
    await tick();
    expect(stats.snapshot().errors_total).toBe(1);
  });

  it('recovers slow windows after slowMs', async () => {
    const stats = new WatchdogStats(0);
    const recoverSlow = jest.fn().mockResolvedValue({ windowTitle: 'mlc', outcome: { stopped: true, dismissed: [], submitted: true } });
    const { tick } = startDaemon({
      actions: actions({
        observe: async () => [
          {
            windowTitle: 'mlc',
            composerId: 'x',
            model: 'Composer',
            agentRole: 'default',
            busy: true,
            slowCount: 2,
            reconnecting: false,
            draftLen: 20,
            draftHasToken: true,
            pairs: [{ preview: 'STEP=16', slow: true }],
          },
        ],
        recoverSlow,
      }),
      stats,
      pollMs: 1000,
      slowMs: 0,
      busyMs: 600_000,
    });
    await tick();
    expect(recoverSlow).toHaveBeenCalledWith('mlc');
    expect(stats.snapshot().slow_recoveries_total).toBe(1);
  });

  it('recovers busy-only windows after busyMs', async () => {
    const stats = new WatchdogStats(0);
    const recoverSlow = jest.fn().mockResolvedValue({ windowTitle: 'mlc', outcome: { stopped: true, dismissed: [], submitted: true } });
    const tracker = new StuckTracker();
    tracker.noteBusy('mlc', 0);
    const { tick } = startDaemon({
      actions: actions({
        observe: async () => [
          {
            windowTitle: 'mlc',
            composerId: 'x',
            model: 'Composer',
            agentRole: 'default',
            busy: true,
            slowCount: 0,
            reconnecting: false,
            draftLen: 0,
            draftHasToken: false,
            pairs: [],
          },
        ],
        recoverSlow,
      }),
      stats,
      pollMs: 1000,
      slowMs: 90_000,
      busyMs: 1000,
      slowTracker: tracker,
    });
    await tick();
    expect(recoverSlow).toHaveBeenCalledWith('mlc');
    expect(stats.snapshot().slow_recoveries_total).toBe(1);
  });
});
