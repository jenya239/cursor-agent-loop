import { snapshotFingerprint, parseInteractionSnapshot, emptyInteractionSnapshot } from '../../../src/cursor/interaction/snapshot-probe';
import { expect as matchers } from '../../../src/cursor/interaction/expect';

const base = () => emptyInteractionSnapshot('win');

describe('snapshotFingerprint', () => {
  it('changes when agent busy flips', () => {
    const a = { ...base(), agent: { busy: false, reason: 'idle' } };
    const b = { ...base(), agent: { busy: true, reason: 'stop-icon' } };
    expect(snapshotFingerprint(a)).not.toBe(snapshotFingerprint(b));
  });
});

describe('parseInteractionSnapshot', () => {
  it('parses probe payload', () => {
    const s = parseInteractionSnapshot({
      windowTitle: 'mlc - Cursor',
      agent: { busy: true, reason: 'stop-icon' },
      bar: { busy: true, draftLen: 10, slowCount: 0, model: 'gpt', composerId: 'abc' },
      thread: { activeTool: 'Worked for 2s', slowCount: 0, turnCount: 3 },
      blockers: { sendBlocked: true, kinds: ['revert'] },
    });
    expect(s?.bar.draftLen).toBe(10);
    expect(s?.blockers.kinds).toEqual(['revert']);
  });
});

describe('expect matchers', () => {
  it('agentStarted', () => {
    const before = { ...base(), agent: { busy: false, reason: 'idle' } };
    const after = { ...base(), agent: { busy: true, reason: 'stop-icon' } };
    expect(matchers.agentStarted()(before, after).matched).toBe(true);
  });

  it('unchanged', () => {
    const s = base();
    expect(matchers.unchanged()(s, { ...s, at: Date.now() }).matched).toBe(true);
  });

  it('oneOf picks first match', () => {
    const before = base();
    const after = { ...base(), blockers: { sendBlocked: true, kinds: ['revert'] } };
    const r = matchers.oneOf(matchers.agentStarted(), matchers.sendBlocked())(before, after);
    expect(r.matched).toBe(true);
    expect(r.verdict).toBe('blocked');
  });
});
