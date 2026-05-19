import { agentTransition, shouldRefreshChat } from '../../src/ui/poll/refresh-policy';

describe('refresh-policy', () => {
  it('refresh on idle transition', () => {
    const snap = {
      agent: { busy: false, phase: 'idle' as const, dbBusy: false, cdpBusy: false, cdpOk: true, at: 1 },
    };
    expect(
      shouldRefreshChat({
        prevAgent: { busy: true, phase: 'busy', dbBusy: false, cdpBusy: true, cdpOk: true, at: 0 },
        snap: snap as never,
      })
    ).toBe(true);
  });

  it('agentTransition idle', () => {
    expect(
      agentTransition(
        { busy: true, phase: 'busy', dbBusy: false, cdpBusy: true, cdpOk: true, at: 0 },
        { busy: false, phase: 'idle', dbBusy: false, cdpBusy: false, cdpOk: true, at: 1 }
      )
    ).toBe('agent:idle');
  });
});
