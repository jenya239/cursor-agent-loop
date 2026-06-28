import { buildNudgePrompt } from '../prompt/build-nudge';
import type { NextAgentStep } from '../types';
import { checkEnqueueLoop, type ChatLine } from '../../cursor/loop-guard';
import { pickDriverStep } from '../../cursor/agent_next';

export type ResolvedSend =
  | { ok: true; text: string; role: string; step: string }
  | { ok: false; reason: string };

export interface GuardSendContext {
  composerId: string;
  agentDir: string;
  messages: ChatLine[];
  token: string;
  targetId: string;
  pendingTexts?: string[];
}

export function trySendStep(ctx: GuardSendContext, next: NextAgentStep): ResolvedSend {
  const text = buildNudgePrompt(next, ctx.token, ctx.targetId);
  const loop = checkEnqueueLoop({
    composerId: ctx.composerId,
    text,
    agentDir: ctx.agentDir,
    historyMessages: ctx.messages,
    pendingTexts: ctx.pendingTexts,
    source: 'guard',
  });
  if (!loop.allow) return { ok: false, reason: loop.reason ?? 'enqueue blocked' };
  return { ok: true, text: loop.adjustedText ?? text, role: next.role, step: next.step };
}

export function tryDriverFallback(ctx: GuardSendContext, blockedReason: string): ResolvedSend {
  const driver = pickDriverStep(ctx.agentDir);
  if (!driver) return { ok: false, reason: `no driver fallback (${blockedReason})` };
  const sent = trySendStep(ctx, driver);
  return sent.ok ? sent : { ok: false, reason: sent.reason };
}
