import { applyAgentPoll } from '../src/agent-session';

const CHAT = '11111111-1111-1111-1111-111111111111';

describe('applyAgentPoll', () => {
  it('ignores other chats', () => {
    const r = applyAgentPoll(true, CHAT, {
      composerId: 'other',
      agentBusy: false,
      messageCount: 1,
    });
    expect(r.event).toBeNull();
    expect(r.busy).toBe(true);
  });

  it('emits agent:busy', () => {
    const r = applyAgentPoll(false, CHAT, {
      composerId: CHAT,
      agentBusy: true,
      agentStatus: 'generating',
      messageCount: 3,
    });
    expect(r.event).toBe('agent:busy');
    expect(r.busy).toBe(true);
    expect(r.detail?.messageCount).toBe(3);
  });

  it('emits agent:idle', () => {
    const r = applyAgentPoll(true, CHAT, {
      composerId: CHAT,
      agentBusy: false,
      agentStatus: 'completed',
      messageCount: 10,
    });
    expect(r.event).toBe('agent:idle');
    expect(r.busy).toBe(false);
  });

  it('no event when unchanged', () => {
    const r = applyAgentPoll(true, CHAT, {
      composerId: CHAT,
      agentBusy: true,
      messageCount: 1,
    });
    expect(r.event).toBeNull();
  });
});
