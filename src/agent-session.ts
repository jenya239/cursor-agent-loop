export interface AgentEventDetail {
  composerId: string;
  agentStatus?: string;
  messageCount: number;
}

export type AgentEventName = 'agent:busy' | 'agent:idle';

export interface AgentPollInput {
  composerId: string;
  agentBusy: boolean;
  agentStatus?: string;
  messageCount: number;
}

export interface AgentPollResult {
  busy: boolean;
  event: AgentEventName | null;
  detail: AgentEventDetail | null;
}

export function applyAgentPoll(
  prevBusy: boolean,
  activeComposerId: string | null,
  chat: AgentPollInput
): AgentPollResult {
  if (!activeComposerId || chat.composerId !== activeComposerId) {
    return { busy: prevBusy, event: null, detail: null };
  }
  const busy = !!chat.agentBusy;
  const detail: AgentEventDetail = {
    composerId: activeComposerId,
    agentStatus: chat.agentStatus,
    messageCount: chat.messageCount,
  };
  if (busy === prevBusy) {
    return { busy, event: null, detail };
  }
  return { busy, event: busy ? 'agent:busy' : 'agent:idle', detail };
}
