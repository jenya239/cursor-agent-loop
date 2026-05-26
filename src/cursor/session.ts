import type { AgentState } from '../agent-model';

export type ModalState = 'none' | 'pretty_dialog' | 'revert';

export interface CursorSession {
  token?: string;
  composerId: string;
  windowTitle?: string;
  workspaceHints?: string[];
  agent: AgentState;
  queueLength: number;
  modal: ModalState;
  at: number;
}
