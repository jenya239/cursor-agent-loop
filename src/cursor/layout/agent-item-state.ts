import type { AgentItemState } from './types';

export function deriveAgentItemState(item: { active?: boolean; busy?: boolean }): AgentItemState {
  if (item.busy) return 'busy';
  if (item.active) return 'active';
  return 'idle';
}

export function withAgentItemState<T extends { active?: boolean; busy?: boolean }>(
  item: T
): T & { state: AgentItemState } {
  return { ...item, state: deriveAgentItemState(item) };
}
