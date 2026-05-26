import { SendGate } from '../../src/cursor/send-gate';
import type { AgentState } from '../../src/agent-model';

const base: AgentState = {
  phase: 'idle',
  busy: false,
  dbBusy: false,
  cdpBusy: false,
  cdpOk: true,
  at: 0,
};

describe('SendGate', () => {
  it('blocks until settle after busy', () => {
    const gate = new SendGate();
    const cid = 'c1';
    const t0 = 1_000_000;
    expect(gate.canSend({ ...base, cdpBusy: true }, cid, t0)).toBe(false);
    expect(gate.canSend(base, cid, t0 + 1000)).toBe(false);
    expect(gate.canSend(base, cid, t0 + 5000)).toBe(true);
  });

  it('blocks while db generating', () => {
    const gate = new SendGate();
    expect(gate.canSend({ ...base, dbStatus: 'generating' }, 'c1')).toBe(false);
  });
});
