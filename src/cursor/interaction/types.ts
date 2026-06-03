export type StepVerdict =
  | 'matched'
  | 'unchanged'
  | 'started'
  | 'finished'
  | 'blocked'
  | 'timeout'
  | 'error';

export interface InteractionAgent {
  busy: boolean;
  reason: string;
}

export interface InteractionBar {
  busy: boolean;
  draftLen: number;
  slowCount: number;
  model: string;
  composerId: string;
}

export interface InteractionThread {
  activeTool: string | null;
  slowCount: number;
  turnCount: number;
}

export interface InteractionBlockers {
  sendBlocked: boolean;
  kinds: string[];
}

export interface InteractionSnapshot {
  at: number;
  windowTitle: string;
  agent: InteractionAgent;
  bar: InteractionBar;
  thread: InteractionThread;
  blockers: InteractionBlockers;
}

export interface ExpectResult {
  matched: boolean;
  verdict: StepVerdict;
  reason: string;
}

export type ExpectFn = (before: InteractionSnapshot, after: InteractionSnapshot) => ExpectResult;

export interface WaitPolicy {
  intervalMs: number;
  timeoutMs: number;
  settleMs: number;
}

export const DEFAULT_WAIT: WaitPolicy = {
  intervalMs: 400,
  timeoutMs: 15000,
  settleMs: 0,
};

export interface StepContext {
  cdp: import('../../cdp/port').CdpPort;
  before: InteractionSnapshot;
  windowTitle?: string;
}

export interface StepResult {
  ok: boolean;
  verdict: StepVerdict;
  reason: string;
  label?: string;
  elapsedMs: number;
  attempts: number;
  before: InteractionSnapshot;
  after: InteractionSnapshot;
  fallbackUsed: boolean;
  actionError?: string;
}

export interface RunStepOpts {
  label?: string;
  windowTitle?: string;
  action: (ctx: StepContext) => Promise<void>;
  expect?: ExpectFn;
  wait?: Partial<WaitPolicy>;
  fallback?: (ctx: StepContext, partial: StepResult) => Promise<boolean>;
}

export interface WaitForOpts {
  label?: string;
  windowTitle?: string;
  expect: ExpectFn;
  wait?: Partial<WaitPolicy>;
  baseline?: InteractionSnapshot;
}
