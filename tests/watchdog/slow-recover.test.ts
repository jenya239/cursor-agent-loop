import { slowWindowsDue } from '../../src/watchdog/slow-recover';
import { SlowTracker } from '../../src/watchdog/slow-tracker';
import type { WindowObservation } from '../../src/watchdog/observe';

function win(title: string, slowCount: number, busy = true): WindowObservation {
  return {
    windowTitle: title,
    composerId: 'c1',
    model: 'Composer',
    busy,
    slowCount,
    draftLen: 10,
    draftHasToken: true,
    pairs: [],
  };
}

describe('slowWindowsDue', () => {
  it('returns empty when not slow', () => {
    const t = new SlowTracker();
    expect(slowWindowsDue([win('mlc', 0, false)], t, 1000, 5000)).toEqual([]);
  });

  it('waits until slowMs elapsed', () => {
    const t = new SlowTracker();
    expect(slowWindowsDue([win('mlc', 2)], t, 1000, 100)).toEqual([]);
    expect(slowWindowsDue([win('mlc', 2)], t, 1000, 1200)).toEqual(['mlc']);
  });

  it('clears tracker when slow disappears', () => {
    const t = new SlowTracker();
    slowWindowsDue([win('mlc', 2)], t, 100, 1000);
    expect(slowWindowsDue([win('mlc', 0, false)], t, 100, 2000)).toEqual([]);
    expect(slowWindowsDue([win('mlc', 2)], t, 100, 2100)).toEqual([]);
  });
});

describe('SlowTracker', () => {
  it('tracks first seen age', () => {
    const t = new SlowTracker();
    expect(t.note('w', 1, 100)).toBe(0);
    expect(t.note('w', 1, 250)).toBe(150);
    t.clear('w');
    expect(t.note('w', 1, 300)).toBe(0);
  });
});
