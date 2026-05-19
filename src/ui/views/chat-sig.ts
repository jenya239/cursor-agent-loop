import type { ChatDetailResponse } from '../api/types';

export function chatSignature(data: ChatDetailResponse): string {
  const busy = data.agentBusy || data.agent?.busy ? 'b' : 'i';
  const msgs = data.messages || [];
  if (!msgs.length) return `${busy}:0`;
  const last = msgs[msgs.length - 1];
  return `${busy}:${msgs.length}:${last.bubbleId}:${(last.text || '').length}`;
}
