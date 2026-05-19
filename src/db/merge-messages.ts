import type { ChatMessage } from './types';

/** Склеивает подряд идущие сообщения одной роли (особенно assistant). */
export function mergeMessages(msgs: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of msgs) {
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role) {
      prev.text = prev.text ? `${prev.text}\n${m.text}` : m.text;
      continue;
    }
    out.push({ ...m });
  }
  return out;
}
