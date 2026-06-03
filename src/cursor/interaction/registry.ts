import { actions, fallbacks } from './actions';
import { expect } from './expect';
import type { ExpectFn, RunStepOpts, WaitForOpts } from './types';

export type ActionName = 'noop' | 'stop' | 'send' | 'dismiss' | 'switchComposer';
export type ExpectName =
  | 'anyChange'
  | 'unchanged'
  | 'agentStarted'
  | 'agentIdle'
  | 'sendBlocked'
  | 'activeTool';
export type FallbackName = 'dismissModals';

export function resolveAction(
  name: ActionName,
  params?: { text?: string; composerId?: string; windowTitle?: string }
): RunStepOpts['action'] {
  switch (name) {
    case 'noop':
      return actions.noop();
    case 'stop':
      return actions.stop({ windowTitle: params?.windowTitle });
    case 'send':
      if (!params?.text) throw new Error('send requires text');
      return actions.send(params.text, { windowTitle: params?.windowTitle });
    case 'dismiss':
      return actions.dismiss();
    case 'switchComposer':
      if (!params?.composerId) throw new Error('switchComposer requires composerId');
      return actions.switchComposer(params.composerId, { windowTitle: params?.windowTitle });
    default:
      throw new Error(`unknown action: ${name}`);
  }
}

export function resolveExpect(name: ExpectName, params?: { needle?: string }): ExpectFn {
  switch (name) {
    case 'anyChange':
      return expect.anyChange();
    case 'unchanged':
      return expect.unchanged();
    case 'agentStarted':
      return expect.agentStarted();
    case 'agentIdle':
      return expect.agentIdle();
    case 'sendBlocked':
      return expect.sendBlocked();
    case 'activeTool':
      return expect.activeTool(params?.needle);
    default:
      throw new Error(`unknown expect: ${name}`);
  }
}

export function resolveFallback(name: FallbackName): NonNullable<RunStepOpts['fallback']> {
  if (name === 'dismissModals') return fallbacks.dismissModals();
  throw new Error(`unknown fallback: ${name}`);
}

export interface StepRequest {
  label?: string;
  windowTitle?: string;
  action: ActionName;
  actionParams?: { text?: string; composerId?: string; windowTitle?: string };
  expect?: ExpectName;
  expectParams?: { needle?: string };
  wait?: Partial<import('./types').WaitPolicy>;
  fallback?: FallbackName;
}

export interface WaitRequest {
  label?: string;
  windowTitle?: string;
  expect: ExpectName;
  expectParams?: { needle?: string };
  wait?: Partial<import('./types').WaitPolicy>;
}

export function stepRequestToOpts(req: StepRequest): Omit<RunStepOpts, 'action' | 'expect' | 'fallback'> & {
  action: RunStepOpts['action'];
  expect?: ExpectFn;
  fallback?: RunStepOpts['fallback'];
} {
  return {
    label: req.label,
    windowTitle: req.windowTitle,
    action: resolveAction(req.action, req.actionParams),
    expect: req.expect ? resolveExpect(req.expect, req.expectParams) : undefined,
    wait: req.wait,
    fallback: req.fallback ? resolveFallback(req.fallback) : undefined,
  };
}

export function waitRequestToOpts(req: WaitRequest): WaitForOpts {
  return {
    label: req.label,
    windowTitle: req.windowTitle,
    expect: resolveExpect(req.expect, req.expectParams),
    wait: req.wait,
  };
}
