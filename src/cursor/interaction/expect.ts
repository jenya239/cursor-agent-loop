import type { ExpectFn, ExpectResult, StepVerdict } from './types';
import { snapshotFingerprint } from './snapshot-probe';

function hit(matched: boolean, verdict: StepVerdict, reason: string): ExpectResult {
  return { matched, verdict, reason };
}

export const expect = {
  anyChange(): ExpectFn {
    return (before, after) =>
      hit(
        snapshotFingerprint(before) !== snapshotFingerprint(after),
        'matched',
        'state changed'
      );
  },

  unchanged(): ExpectFn {
    return (before, after) =>
      hit(
        snapshotFingerprint(before) === snapshotFingerprint(after),
        'unchanged',
        'no state change'
      );
  },

  agentStarted(): ExpectFn {
    return (before, after) =>
      hit(!before.agent.busy && after.agent.busy, 'started', `agent busy (${after.agent.reason})`);
  },

  agentIdle(): ExpectFn {
    return (before, after) =>
      hit(before.agent.busy && !after.agent.busy, 'finished', 'agent idle');
  },

  sendBlocked(): ExpectFn {
    return (_before, after) =>
      hit(after.blockers.sendBlocked, 'blocked', `blockers: ${after.blockers.kinds.join(',') || 'unknown'}`);
  },

  activeTool(needle?: string | RegExp): ExpectFn {
    return (_before, after) => {
      const t = after.thread.activeTool || '';
      const ok = needle
        ? typeof needle === 'string'
          ? t.toLowerCase().includes(needle.toLowerCase())
          : needle.test(t)
        : !!t;
      return hit(ok, 'started', ok ? `activeTool: ${t}` : 'no active tool');
    };
  },

  draftAtLeast(n: number): ExpectFn {
    return (_before, after) => hit(after.bar.draftLen >= n, 'matched', `draft ${after.bar.draftLen}ch`);
  },

  custom(check: (before: import('./types').InteractionSnapshot, after: import('./types').InteractionSnapshot) => boolean, verdict: StepVerdict, reason: string): ExpectFn {
    return (before, after) => hit(check(before, after), verdict, reason);
  },

  oneOf(...fns: ExpectFn[]): ExpectFn {
    return (before, after) => {
      for (const fn of fns) {
        const r = fn(before, after);
        if (r.matched) return r;
      }
      return hit(false, 'timeout', 'no expectation matched');
    };
  },
};
