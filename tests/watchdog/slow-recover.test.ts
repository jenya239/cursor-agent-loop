import { hasReconnectIndicator, hasSlowIndicator, stuckWindowsDue } from '../../src/watchdog/slow-recover';
import { StuckTracker } from '../../src/watchdog/stuck-tracker';
import type { WindowObservation } from '../../src/watchdog/observe';

function win(
  title: string,
  opts: { slowCount?: number; busy?: boolean; slowPair?: boolean; reconnecting?: boolean }
): WindowObservation {
  return {
    windowTitle: title,
    composerId: 'c1',
    model: 'Composer',
    agentRole: 'default',
    busy: opts.busy ?? true,
    slowCount: opts.slowCount ?? 0,
    reconnecting: opts.reconnecting ?? false,
    draftLen: 10,
    draftHasToken: true,
    pairs: opts.slowPair ? [{ preview: 'STEP=1', slow: true }] : [],
  };
}

describe('hasReconnectIndicator', () => {
  it('true when reconnecting', () => {
    expect(hasReconnectIndicator(win('mlc', { reconnecting: true }))).toBe(true);
    expect(hasReconnectIndicator(win('mlc', { reconnecting: false }))).toBe(false);
  });
});

describe('hasSlowIndicator', () => {
  it('true for slowCount or slow pair', () => {
    expect(hasSlowIndicator(win('a', { slowCount: 1 }))).toBe(true);
    expect(hasSlowIndicator(win('a', { slowCount: 0, slowPair: true }))).toBe(true);
    expect(hasSlowIndicator(win('a', { slowCount: 0, slowPair: false }))).toBe(false);
  });
});

describe('stuckWindowsDue', () => {
  it('returns empty when idle', () => {
    const t = new StuckTracker();
    expect(stuckWindowsDue([win('mlc', { busy: false })], t, { slowMs: 1000, busyMs: 5000, reconnectMs: 2000 }, 5000)).toEqual([]);
  });

  it('slow path: slowCount waits slowMs', () => {
    const t = new StuckTracker();
    expect(stuckWindowsDue([win('mlc', { slowCount: 2 })], t, { slowMs: 1000, busyMs: 5000, reconnectMs: 60_000 }, 100)).toEqual([]);
    expect(stuckWindowsDue([win('mlc', { slowCount: 2 })], t, { slowMs: 1000, busyMs: 5000, reconnectMs: 60_000 }, 1200)).toEqual(['mlc']);
  });

  it('slow path: slow pair without slowCount', () => {
    const t = new StuckTracker();
    expect(stuckWindowsDue([win('mlc', { slowPair: true })], t, { slowMs: 500, busyMs: 9000, reconnectMs: 60_000 }, 0)).toEqual([]);
    expect(stuckWindowsDue([win('mlc', { slowPair: true })], t, { slowMs: 500, busyMs: 9000, reconnectMs: 60_000 }, 600)).toEqual(['mlc']);
  });

  it('reconnect path uses reconnectMs', () => {
    const t = new StuckTracker();
    expect(
      stuckWindowsDue([win('mlc', { reconnecting: true })], t, { slowMs: 100, busyMs: 5000, reconnectMs: 800 }, 100)
    ).toEqual([]);
    expect(
      stuckWindowsDue([win('mlc', { reconnecting: true })], t, { slowMs: 100, busyMs: 5000, reconnectMs: 800 }, 900)
    ).toEqual(['mlc']);
  });

  it('busy path: no slow indicators waits busyMs', () => {
    const t = new StuckTracker();
    expect(stuckWindowsDue([win('mlc', {})], t, { slowMs: 100, busyMs: 5000, reconnectMs: 60_000 }, 1000)).toEqual([]);
    expect(stuckWindowsDue([win('mlc', {})], t, { slowMs: 100, busyMs: 5000, reconnectMs: 60_000 }, 6100)).toEqual(['mlc']);
  });

  it('timer continues when slow label disappears but busy remains', () => {
    const t = new StuckTracker();
    stuckWindowsDue([win('mlc', { slowPair: true })], t, { slowMs: 1000, busyMs: 5000, reconnectMs: 60_000 }, 0);
    expect(stuckWindowsDue([win('mlc', {})], t, { slowMs: 1000, busyMs: 5000, reconnectMs: 60_000 }, 800)).toEqual([]);
    expect(stuckWindowsDue([win('mlc', {})], t, { slowMs: 1000, busyMs: 5000, reconnectMs: 60_000 }, 5100)).toEqual(['mlc']);
  });

  it('clears tracker when not busy', () => {
    const t = new StuckTracker();
    stuckWindowsDue([win('mlc', { slowCount: 1 })], t, { slowMs: 100, busyMs: 5000, reconnectMs: 60_000 }, 1000);
    expect(stuckWindowsDue([win('mlc', { busy: false })], t, { slowMs: 100, busyMs: 5000, reconnectMs: 60_000 }, 2000)).toEqual([]);
    expect(stuckWindowsDue([win('mlc', { slowCount: 1 })], t, { slowMs: 100, busyMs: 5000, reconnectMs: 60_000 }, 2100)).toEqual([]);
  });
});

describe('StuckTracker', () => {
  it('tracks busy age', () => {
    const t = new StuckTracker();
    expect(t.noteBusy('w', 100)).toBe(0);
    expect(t.noteBusy('w', 250)).toBe(150);
    t.clear('w');
    expect(t.noteBusy('w', 300)).toBe(0);
  });
});
