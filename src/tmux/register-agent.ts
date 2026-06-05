import { upsertAgentState, type AgentStateRow } from '../db/agent-states';

export type RegisterAgentOptions = {
  databasePath?: string;
};

export function registerAgent(
  pane: string,
  role: string,
  token: string,
  options?: RegisterAgentOptions
): AgentStateRow {
  const paneTarget = pane.trim();
  if (!paneTarget) throw new Error('tmux pane target is required');
  const agentToken = token.trim();
  if (!agentToken) throw new Error('agent token is required');
  const agentRole = role.trim();
  if (!agentRole) throw new Error('agent role is required');
  return upsertAgentState({
    token: agentToken,
    composerId: paneTarget,
    role: agentRole,
    databasePath: options?.databasePath,
  });
}
