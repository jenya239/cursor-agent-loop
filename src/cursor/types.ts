import type { AgentState } from '../agent-model';
import type { ChatMessage, ChatSummary } from '../db/types';
import type { ComposerAgentPageProbe } from '../cdp/probes/composer-agent.v1';

export interface CursorWindow {
  id: string;
  title: string;
  type: string;
  url: string;
  hasComposer: boolean;
}

export interface ComposerUiState {
  windowTitle: string;
  probe: ComposerAgentPageProbe;
}

export interface CursorSnapshot {
  at: number;
  cdp: { ok: boolean };
  windows: CursorWindow[];
  composerByWindow: ComposerUiState[];
  chats: ChatSummary[];
  agent: AgentState;
}

export interface ChatDetailView {
  summary: ChatSummary;
  composerId: string;
  messages: ChatMessage[];
  agent: AgentState;
}
