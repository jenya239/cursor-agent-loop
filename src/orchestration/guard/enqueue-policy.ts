import type { LoopDecision } from '../types';
import { countRecentSameKey, parseAgentPrompt, promptKey } from './prompt-meta';

export interface OrchEntry {
  lastAt?: number;
  lastKey?: string;
  repeatKey?: number;
}

export interface EnqueuePolicyConfig {
  dedupMs: number;
  loopMs: number;
  loopRepeat: number;
}

export const DEFAULT_ENQUEUE_POLICY: EnqueuePolicyConfig = {
  dedupMs: 6 * 60_000,
  loopMs: 2 * 60 * 60_000,
  loopRepeat: 2,
};

export function checkHistoryAndPending(
  key: string,
  messages?: { role: string; text: string }[],
  pendingTexts?: string[],
  source?: 'agent' | 'guard' | 'mcp'
): LoopDecision | null {
  if (messages?.length) {
    const lastMsg = messages[messages.length - 1];
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      const lastUserKey = promptKey(parseAgentPrompt(lastUser.text));
      if (lastUserKey === key && lastMsg.role === 'user') {
        return { allow: false, reason: `same step waiting in chat (${key})` };
      }
      if (lastUserKey === key && lastMsg.role === 'assistant') {
        return { allow: false, reason: `step ${key} already ran; enqueue next STEP` };
      }
    }
    const tail = source === 'guard' ? 6 : 8;
    const n = countRecentSameKey(messages, key, tail);
    if (n >= 2) {
      return { allow: false, reason: `step ${key} already sent ${n}x in chat` };
    }
  }
  if (pendingTexts?.length) {
    for (const t of pendingTexts) {
      if (promptKey(parseAgentPrompt(t)) === key) {
        return { allow: false, reason: `step ${key} already queued` };
      }
    }
  }
  return null;
}

export function checkOrchDedup(
  key: string,
  entry: OrchEntry,
  now: number,
  cfg: EnqueuePolicyConfig = DEFAULT_ENQUEUE_POLICY
): LoopDecision | null {
  if (entry.lastKey === key && entry.lastAt != null && now - entry.lastAt < cfg.dedupMs) {
    return { allow: false, reason: `duplicate enqueue (${key})` };
  }
  if (
    entry.lastKey === key &&
    (entry.repeatKey ?? 0) >= cfg.loopRepeat &&
    entry.lastAt != null &&
    now - entry.lastAt < cfg.loopMs
  ) {
    return { allow: false, reason: `step loop (${key})` };
  }
  return null;
}

export function isExpectedLoopBlock(reason?: string): boolean {
  if (!reason) return false;
  return /waiting in chat|already queued|duplicate enqueue|already sent|already answered|already ran|turn pending/i.test(
    reason
  );
}

export function isExpectedSendBlock(err?: string): boolean {
  if (!err) return false;
  return /send blocked:|duplicate enqueue|waiting in chat|already sent|already queued|step loop|already answered|already ran|turn pending|agent busy|user typing/i.test(
    err
  );
}
