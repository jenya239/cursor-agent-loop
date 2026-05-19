import { chatSignature } from '../../src/ui/views/chat-sig';

describe('chatSignature', () => {
  it('includes busy flag and message tail', () => {
    const sig = chatSignature({
      composerId: 'x',
      messages: [{ role: 'user', text: 'hi', bubbleId: 'b1' }],
      agent: { phase: 'idle', busy: false, dbBusy: false, cdpBusy: false, cdpOk: true, at: 1 },
      agentBusy: true,
    });
    expect(sig.startsWith('b:')).toBe(true);
    expect(sig).toContain('b1');
  });
});
