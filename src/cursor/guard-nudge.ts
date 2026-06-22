import {
  buildNudgePrompt,
  pickDriverStep,
  pickNextAgentStep,
  type NextAgentStep,
} from './agent_next';
import {
  checkEnqueueLoop,
  countRecentSameKey,
  lastUserPromptKey,
  promptKey,
  syncOrchFromChat,
  type ChatLine,
} from './loop-guard';

export type GuardPlan =
  | { action: 'skip'; reason: string }
  | { action: 'send'; text: string; role: string; step: string }
  | { action: 'recovery'; text: string; reason: string; role: string; step: string };

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

export function isExpectedSendBlock(err?: string): boolean {
  if (!err) return false;
  return /send blocked:|duplicate enqueue|waiting in chat|already sent|already queued|step loop|already answered|already ran|turn pending|agent busy/i.test(
    err
  );
}

function recoveryPrompt(token: string, targetId: string, reason: string): string {
  const base = buildNudgePrompt(recoveryStep(targetId), token, targetId);
  return `${base}\n\nGuard: ${reason}. Do not re-enqueue the same Driver STEP. Finish commit or enqueue next pending STEP once.`;
}

/** Decide whether overnight guard should send, skip, or Meta-recover. */
export function planGuardNudge(opts: {
  composerId: string;
  agentDir: string;
  messages: ChatLine[];
  token: string;
  targetId: string;
  pendingTexts?: string[];
}): GuardPlan {
  syncOrchFromChat(opts.composerId, opts.messages);

  const lastMsg = opts.messages[opts.messages.length - 1];
  const lastUserKey = lastUserPromptKey(opts.messages);
  const next = pickNextAgentStep(opts.agentDir);
  const nextKey = promptKey({ role: next.role, step: next.step, trackFile: next.trackFile });

  if (lastMsg?.role === 'user' && lastUserKey) {
    return { action: 'skip', reason: 'turn pending in chat' };
  }

  const recovKey = promptKey({ role: 'Driver', step: 'recovery' });
  const recovBlocked = countRecentSameKey(opts.messages, recovKey, 6) >= 1;

  if (
    lastMsg?.role === 'assistant' &&
    lastUserKey &&
    lastUserKey === nextKey &&
    next.role === 'Driver' &&
    !recovBlocked
  ) {
    const r = splitRecovery(opts.token, opts.targetId, `stuck ${lastUserKey} after assistant`);
    return { action: 'recovery', reason: r.reason, text: r.text, role: r.role, step: r.step };
  }

  if (next.role === 'Driver' && countRecentSameKey(opts.messages, nextKey) >= 2 && !recovBlocked) {
    const r = splitRecovery(opts.token, opts.targetId, `step ${nextKey} loop`);
    return { action: 'recovery', reason: r.reason, text: r.text, role: r.role, step: r.step };
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
      const r = splitRecovery(opts.token, opts.targetId, loop.reason ?? 'blocked');
      return { action: 'recovery', reason: r.reason, text: r.text, role: r.role, step: r.step };
    }
    // Recovery blocked + aborted turn: force-resend same step
    if (recovBlocked && /already ran|already answered/i.test(loop.reason ?? '') && next.role === 'Driver') {
      return { action: 'send', text, role: next.role, step: next.step };
    }
    // Rotated non-Driver step is deduped — fall back to the pending Driver step.
    if (next.role !== 'Driver') {
      const driver = pickDriverStep(opts.agentDir);
      if (driver) {
        const driverText = buildNudgePrompt(driver, opts.token, opts.targetId);
        const driverLoop = checkEnqueueLoop({
          composerId: opts.composerId,
          text: driverText,
          agentDir: opts.agentDir,
          historyMessages: opts.messages,
          pendingTexts: opts.pendingTexts,
          source: 'guard',
        });
        if (driverLoop.allow) {
          const t = driverLoop.adjustedText ?? driverText;
          return { action: 'send', text: t, role: driver.role, step: driver.step };
        }
      }
    }
    return { action: 'skip', reason: loop.reason ?? 'enqueue blocked' };
  }

  text = loop.adjustedText ?? text;
  return { action: 'send', text, role: next.role, step: next.step };
}

export function buildGuardRecovery(token: string, targetId: string, reason: string) {
  const step = recoveryStep(targetId);
  return {
    text: recoveryPrompt(token, targetId, reason),
    role: step.role,
    step: step.step,
    reason,
  };
}

function splitRecovery(token: string, targetId: string, reason: string) {
  return buildGuardRecovery(token, targetId, reason);
}
