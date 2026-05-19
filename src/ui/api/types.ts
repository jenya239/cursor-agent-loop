export type { AgentState } from '../../agent-model';
export type { ChatMessage, ChatSummary } from '../../db/types';
export type { CursorSnapshot, ChatDetailView, ComposerUiState, CursorWindow } from '../../cursor/types';

export interface ChatsPayload {
  chats: import('../../db/types').ChatSummary[];
  partial?: boolean;
  loading?: boolean;
}

export interface StoreStatus {
  ready: boolean;
  loading: boolean;
  partial: boolean;
  count: number;
  cachedAt: number | null;
  error: string | null;
}

export interface ChatDetailResponse {
  composerId: string;
  messages: import('../../db/types').ChatMessage[];
  agent: import('../../agent-model').AgentState;
  summary?: import('../../cursor/types').ChatDetailView['summary'];
  agentBusy?: boolean;
  agentBusyDb?: boolean;
  agentStatus?: string;
  name?: string;
  workspacePath?: string;
  workspaceLabel?: string;
  unifiedMode?: string;
}

export interface SendResponse {
  ok: true;
  text: string;
  pageTitle?: string;
}
