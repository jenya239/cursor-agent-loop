import { WatchdogStats } from '../../src/watchdog/stats';

describe('WatchdogStats', () => {
  it('starts with zero counters', () => {
    const s = new WatchdogStats(1000);
    expect(s.snapshot(5000)).toEqual({
      uptime_ms: 4000,
      polls_total: 0,
      modals_dismissed: { pretty_dialog: 0, revert: 0 },
      drain_sent_total: 0,
      slow_recoveries_total: 0,
      errors_total: 0,
      last_dismiss_at: null,
      last_observe_at: null,
      paused: false,
      windows: [],
    });
  });

  it('records poll and dismiss', () => {
    const s = new WatchdogStats(0);
    s.recordPoll();
    s.recordDismiss('pretty_dialog', { btn: "Don't revert" });
    const snap = s.snapshot(100);
    expect(snap.polls_total).toBe(1);
    expect(snap.modals_dismissed.pretty_dialog).toBe(1);
    expect(snap.last_dismiss_at).toBeTruthy();
  });

  it('records observe and slow recover', () => {
    const s = new WatchdogStats(0);
    s.recordObserve([{ windowTitle: 'mlc', composerId: 'x', model: 'Fast', busy: true, slowCount: 1, draftLen: 3, draftHasToken: true }]);
    s.recordSlowRecover('mlc', { submitted: true });
    const snap = s.snapshot(100);
    expect(snap.windows).toHaveLength(1);
    expect(snap.last_observe_at).toBeTruthy();
    expect(snap.slow_recoveries_total).toBe(1);
  });

  it('ring buffer keeps last 100 events', () => {
    const s = new WatchdogStats(0);
    for (let i = 0; i < 110; i++) s.recordError(`e${i}`);
    const log = s.events();
    expect(log).toHaveLength(100);
    expect(log[0].message).toBe('e10');
    expect(log[99].message).toBe('e109');
  });

  it('pause flag', () => {
    const s = new WatchdogStats(0);
    s.setPaused(true);
    expect(s.snapshot().paused).toBe(true);
  });
});
