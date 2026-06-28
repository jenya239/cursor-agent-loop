import type { ChatLine, GuardPlan, NextAgentStep } from '../types';
import { pickNextAgentStep } from '../../cursor/agent_next';
import { checkEnqueueLoop, syncOrchFromChat } from '../../cursor/loop-guard';
import { buildNudgePrompt } from '../prompt/build-nudge';
import { countRecentSameKey, lastUserPromptKey, promptKey } from './prompt-meta';
import { tryDriverFallback, type GuardSendContext } from './resolve-send';

function recoveryStep(targetId: string): NextAgentStep {
  return {
    role: 'Driver',
    step: 'recovery',
    trackFile: targetId === 'cr' ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
    focus: 'stability',
    reason: 'Orchestration recovery: step loop or stuck turn',
    refs: ['@docs/agent/CONTINUITY.md'],
  };
}

function recoveryPrompt(token: string, targetId: string, reason: string): string {
  const base = buildNudgePrompt(recoveryStep(targetId), token, targetId);
  return `${base}\n\nGuard: ${reason}. Do not re-enqueue the same Driver STEP. Finish commit or enqueue next pending STEP once.`;
}

export function buildGuardRecovery(token: string, targetId: string, reason: string) {
  const step = recoveryStep(targetId);
  return { text: recoveryPrompt(token, targetId, reason), role: step.role, step: step.step, reason };
}

export function planGuardNudge(opts: {
  composerId: string;
  agentDir: string;
  messages: ChatLine[];
  token: string;
  targetId: string;
  pendingTexts?: string[];
}): GuardPlan {
  syncOrchFromChat(opts.composerId, opts.messages);

  const ctx: GuardSendContext = {
    composerId: opts.composerId,
    agentDir: opts.agentDir,
    messages: opts.messages,
    token: opts.token,
    targetId: opts.targetId,
    pendingTexts: opts.pendingTexts,
  };

  const lastMsg = opts.messages[opts.messages.length - 1];
  const lastUserKey = lastUserPromptKey(opts.messages);
  const next = pickNextAgentStep(opts.agentDir);
  const nextKey = promptKey({ role: next.role, step: next.step, trackFile: next.trackFile });

  if (lastMsg?.role === 'user' && lastUserKey) {
    return { action: 'skip', reason: 'turn pending in chat' };
  }

  const recovKey = promptKey(recoveryStep(opts.targetId));
  const recovKeyShort = promptKey({ role: 'Driver', step: 'recovery' });
  const recovBlocked =
    countRecentSameKey(opts.messages, recovKey, 8) >= 1 ||
    countRecentSameKey(opts.messages, recovKeyShort, 8) >= 1;

  if (
    lastMsg?.role === 'assistant' &&
    lastUserKey &&
    lastUserKey === nextKey &&
    next.role === 'Driver' &&
    !recovBlocked
  ) {
    const r = buildGuardRecovery(opts.token, opts.targetId, `stuck ${lastUserKey} after assistant`);
    return { action: 'recovery', ...r };
  }

  if (next.role === 'Driver' && countRecentSameKey(opts.messages, nextKey) >= 2 && !recovBlocked) {
    const r = buildGuardRecovery(opts.token, opts.targetId, `step ${nextKey} loop`);
    return { action: 'recovery', ...r };
  }

  let text = buildNudgePrompt(next, opts.token, opts.targetId);
  const loop = checkEnqueueLoop({
    composerId: opts.composerId,
    text,
    agentDir: opts.agentDir,
    historyMessages: opts.messages,
    pendingTexts: opts.pendingTexts,
    source: 'guard',
  });

  if (!loop.allow) {
    if (!recovBlocked && /already answered|already ran|waiting in chat/i.test(loop.reason ?? '')) {
      const r = buildGuardRecovery(opts.token, opts.targetId, loop.reason ?? 'blocked');
      return { action: 'recovery', ...r };
    }
    if (recovBlocked && /already ran|already answered/i.test(loop.reason ?? '') && next.role === 'Driver') {
      return { action: 'send', text, role: next.role, step: next.step };
    }
    if (/already sent \d+x/i.test(loop.reason ?? '') && next.role === 'Driver') {
      const planRefresh: NextAgentStep = {
        role: 'Planner',
        step: 'plan-refresh',
        trackFile: 'TRACK_PLAN.md',
        focus: 'stability',
        reason: `Driver step stuck: ${loop.reason ?? 'blocked'}`,
        refs: ['@docs/agent/CONTINUITY.md'],
      };
      const planText = buildNudgePrompt(planRefresh, opts.token, opts.targetId);
      const planLoop = checkEnqueueLoop({
        composerId: opts.composerId,
        text: planText,
        agentDir: opts.agentDir,
        historyMessages: opts.messages,
        pendingTexts: opts.pendingTexts,
        source: 'guard',
      });
      if (planLoop.allow) {
        return {
          action: 'send',
          text: planLoop.adjustedText ?? planText,
          role: 'Planner',
          step: 'plan-refresh',
        };
      }
    }
    const fb = tryDriverFallback(ctx, loop.reason ?? 'blocked');
    if (fb.ok) return { action: 'send', text: fb.text, role: fb.role, step: fb.step };
    if (/already sent \d+x/i.test(loop.reason ?? '')) {
      const r = buildGuardRecovery(opts.token, opts.targetId, loop.reason ?? 'driver loop');
      const recovLoop = checkEnqueueLoop({
        composerId: opts.composerId,
        text: r.text,
        agentDir: opts.agentDir,
        historyMessages: opts.messages,
        pendingTexts: opts.pendingTexts,
        source: 'guard',
      });
      if (recovLoop.allow) return { action: 'recovery', ...r };
    }
    return { action: 'skip', reason: loop.reason ?? 'enqueue blocked' };
  }

  text = loop.adjustedText ?? text;
  return { action: 'send', text, role: next.role, step: next.step };
}
