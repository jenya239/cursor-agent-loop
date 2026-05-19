import { isAgentBusy } from '../src/db/agent-state';

describe('isAgentBusy', () => {
  it('false when idle', () => {
    expect(isAgentBusy({ status: 'completed' })).toBe(false);
    expect(isAgentBusy(null)).toBe(false);
  });

  it('true when generating', () => {
    expect(isAgentBusy({ status: 'generating' })).toBe(true);
    expect(isAgentBusy({ generatingBubbleIds: ['b1'] })).toBe(true);
    expect(isAgentBusy({ isContinuationInProgress: true })).toBe(true);
  });

  it('user last message pending', () => {
    expect(
      isAgentBusy({
        status: 'generating',
        fullConversationHeadersOnly: [{ bubbleId: 'u1', type: 1 }],
      })
    ).toBe(true);
    expect(
      isAgentBusy({
        status: 'completed',
        fullConversationHeadersOnly: [{ bubbleId: 'u1', type: 1 }],
      })
    ).toBe(false);
  });
});
