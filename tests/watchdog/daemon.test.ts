import { startDaemon } from '../../src/watchdog/daemon';
import { WatchdogStats } from '../../src/watchdog/stats';
import type { WatchdogActions } from '../../src/watchdog/actions';

describe('startDaemon', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs tick on interval', async () => {
    const stats = new WatchdogStats(0);
    const dismissModals = jest.fn().mockResolvedValue([]);
    const drainQueue = jest.fn().mockResolvedValue({ sent: 0, remaining: 0 });
    const actions: WatchdogActions = { dismissModals, drainQueue };

    const { tick } = startDaemon({ actions, stats, pollMs: 1000 });
    await tick();
    expect(stats.snapshot().polls_total).toBe(1);
    expect(dismissModals).toHaveBeenCalledTimes(1);
    expect(drainQueue).toHaveBeenCalledTimes(1);
  });

  it('records dismiss and drain', async () => {
    const stats = new WatchdogStats(0);
    const actions: WatchdogActions = {
      dismissModals: async () => [{ kind: 'pretty_dialog', open: true, action: 'cancel' }],
      drainQueue: async () => ({ sent: 3, remaining: 0 }),
    };
    const { tick } = startDaemon({ actions, stats, pollMs: 1000 });
    await tick();
    expect(stats.snapshot().modals_dismissed.pretty_dialog).toBe(1);
    expect(stats.snapshot().drain_sent_total).toBe(3);
  });

  it('skips tick when paused', async () => {
    const stats = new WatchdogStats(0);
    stats.setPaused(true);
    const dismissModals = jest.fn();
    const { tick } = startDaemon({
      actions: { dismissModals, drainQueue: async () => ({ sent: 0, remaining: 0 }) },
      stats,
      pollMs: 1000,
    });
    await tick();
    expect(dismissModals).not.toHaveBeenCalled();
  });

  it('records errors', async () => {
    const stats = new WatchdogStats(0);
    const actions: WatchdogActions = {
      dismissModals: async () => { throw new Error('cdp down'); },
      drainQueue: async () => ({ sent: 0, remaining: 0 }),
    };
    const { tick } = startDaemon({ actions, stats, pollMs: 1000 });
    await tick();
    expect(stats.snapshot().errors_total).toBe(1);
  });
});
