import type { AgentState } from '../../agent-model';
import type { CursorSnapshot } from '../../cursor/types';

export interface RefreshContext {
  prevAgent: AgentState | null;
  snap: CursorSnapshot;
  force?: boolean;
  afterSend?: boolean;
}

export function shouldRefreshChat(ctx: RefreshContext): boolean {
  if (ctx.force || ctx.afterSend) return true;
  const prev = ctx.prevAgent;
  const next = ctx.snap.agent;
  if (prev?.busy && !next.busy) return true;
  return false;
}

export function agentTransition(
  prev: AgentState | null,
  next: AgentState
): 'agent:busy' | 'agent:idle' | null {
  if (!prev) return null;
  if (!prev.busy && next.busy) return 'agent:busy';
  if (prev.busy && !next.busy) return 'agent:idle';
  return null;
}
