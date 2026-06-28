import {
  checkHistoryAndPending,
  checkOrchDedup,
  isExpectedLoopBlock,
  isExpectedSendBlock,
  DEFAULT_ENQUEUE_POLICY,
} from '../../../src/orchestration/guard/enqueue-policy';

describe('enqueue-policy', () => {
  it('blocks waiting in chat', () => {
    const r = checkHistoryAndPending('Driver:3', [{ role: 'user', text: 'ROLE=Driver\nSTEP=3' }]);
    expect(r?.allow).toBe(false);
    expect(r?.reason).toContain('waiting in chat');
  });

  it('blocks already ran after assistant', () => {
    const r = checkHistoryAndPending('Driver:3', [
      { role: 'user', text: 'ROLE=Driver\nSTEP=3' },
      { role: 'assistant', text: 'done' },
    ]);
    expect(r?.reason).toContain('already ran');
  });

  it('blocks already sent 2x (guard tail)', () => {
    const driver = {
      role: 'user' as const,
      text: 'ROLE=Driver\nSTEP=6\n@docs/agent/TRACK_BOOTSTRAP_LINK.md\nx',
    };
    const planner = {
      role: 'user' as const,
      text: 'ROLE=Planner\nSTEP=plan-refresh\n@docs/agent/TRACK_PLAN.md\ny',
    };
    const r = checkHistoryAndPending(
      'Driver:6:BOOTSTRAP_LINK',
      [driver, driver, { role: 'assistant', text: 'a' }, planner, { role: 'assistant', text: 'b' }],
      undefined,
      'guard'
    );
    expect(r?.reason).toMatch(/already sent 2x/);
  });

  it('blocks queued duplicate', () => {
    const r = checkHistoryAndPending('Driver:4', [], ['ROLE=Driver\nSTEP=4']);
    expect(r?.reason).toContain('queued');
  });

  it('orch dedup within window', () => {
    const now = Date.now();
    const r = checkOrchDedup('Driver:1', { lastKey: 'Driver:1', lastAt: now - 1000 }, now);
    expect(r?.reason).toContain('duplicate');
  });

  it('orch step loop after repeat threshold', () => {
    const now = Date.now();
    const r = checkOrchDedup(
      'Driver:1',
      {
        lastKey: 'Driver:1',
        lastAt: now - DEFAULT_ENQUEUE_POLICY.dedupMs - 1000,
        repeatKey: DEFAULT_ENQUEUE_POLICY.loopRepeat,
      },
      now
    );
    expect(r?.reason).toContain('step loop');
  });

  it('isExpectedLoopBlock / isExpectedSendBlock', () => {
    expect(isExpectedLoopBlock('already sent 2x in chat')).toBe(true);
    expect(isExpectedSendBlock('send blocked: agent busy')).toBe(true);
    expect(isExpectedSendBlock('network error')).toBe(false);
  });
});
