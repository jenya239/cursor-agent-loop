import type { CdpPort } from '../../cdp/port';
import { expect } from './expect';
import { captureSnapshot } from './snapshot';
import {
  DEFAULT_WAIT,
  type RunStepOpts,
  type StepContext,
  type StepResult,
  type WaitForOpts,
  type WaitPolicy,
} from './types';
import { sleep } from './wait';

function mergeWait(partial?: Partial<WaitPolicy>): WaitPolicy {
  return { ...DEFAULT_WAIT, ...partial };
}

export async function waitFor(cdp: CdpPort, opts: WaitForOpts): Promise<StepResult> {
  const wait = mergeWait(opts.wait);
  const before = opts.baseline ?? (await captureSnapshot(cdp, opts.windowTitle));
  const t0 = Date.now();
  let attempts = 0;
  let after = before;

  while (Date.now() - t0 < wait.timeoutMs) {
    attempts++;
    after = await captureSnapshot(cdp, opts.windowTitle);
    const r = opts.expect(before, after);
    if (r.matched) {
      return {
        ok: true,
        verdict: r.verdict,
        reason: r.reason,
        label: opts.label,
        elapsedMs: Date.now() - t0,
        attempts,
        before,
        after,
        fallbackUsed: false,
      };
    }
    await sleep(wait.intervalMs);
  }

  return {
    ok: false,
    verdict: 'timeout',
    reason: `timeout ${wait.timeoutMs}ms`,
    label: opts.label,
    elapsedMs: Date.now() - t0,
    attempts,
    before,
    after,
    fallbackUsed: false,
  };
}

export async function runStep(cdp: CdpPort, opts: RunStepOpts): Promise<StepResult> {
  const wait = mergeWait(opts.wait);
  const expectFn = opts.expect ?? expect.anyChange();
  const before = await captureSnapshot(cdp, opts.windowTitle);
  const ctx: StepContext = { cdp, before, windowTitle: opts.windowTitle };
  const t0 = Date.now();
  let actionError: string | undefined;

  try {
    await opts.action(ctx);
  } catch (e) {
    actionError = e instanceof Error ? e.message : String(e);
  }

  if (wait.settleMs > 0) await sleep(wait.settleMs);

  let attempts = 0;
  let after = before;
  while (Date.now() - t0 < wait.timeoutMs) {
    attempts++;
    after = await captureSnapshot(cdp, opts.windowTitle);
    const r = expectFn(before, after);
    if (r.matched) {
      return {
        ok: !actionError,
        verdict: actionError ? 'error' : r.verdict,
        reason: actionError ? actionError : r.reason,
        label: opts.label,
        elapsedMs: Date.now() - t0,
        attempts,
        before,
        after,
        fallbackUsed: false,
        actionError,
      };
    }
    await sleep(wait.intervalMs);
  }

  let fallbackUsed = false;
  if (opts.fallback) {
    const partial: StepResult = {
      ok: false,
      verdict: 'timeout',
      reason: 'timeout before fallback',
      label: opts.label,
      elapsedMs: Date.now() - t0,
      attempts,
      before,
      after,
      fallbackUsed: false,
      actionError,
    };
    fallbackUsed = await opts.fallback(ctx, partial);
    if (fallbackUsed) {
      const fb = await waitFor(cdp, {
        label: opts.label ? `${opts.label}:fallback` : 'fallback',
        windowTitle: opts.windowTitle,
        expect: expectFn,
        wait: { timeoutMs: Math.min(wait.timeoutMs, 8000), intervalMs: wait.intervalMs },
        baseline: before,
      });
      return { ...fb, fallbackUsed: true, actionError };
    }
  }

  return {
    ok: false,
    verdict: actionError ? 'error' : 'timeout',
    reason: actionError ?? `timeout ${wait.timeoutMs}ms`,
    label: opts.label,
    elapsedMs: Date.now() - t0,
    attempts,
    before,
    after,
    fallbackUsed,
    actionError,
  };
}

export async function runSteps(cdp: CdpPort, steps: RunStepOpts[]): Promise<StepResult[]> {
  const out: StepResult[] = [];
  for (const step of steps) {
    const r = await runStep(cdp, step);
    out.push(r);
    if (!r.ok && r.verdict !== 'unchanged') break;
  }
  return out;
}
