import type { AgentState } from '../../agent-model';
import type { ChatSummary } from '../../db/types';
import type { CursorSnapshot } from '../../cursor/types';
import type { ChatDetailResponse } from '../api/types';

export type UiAction =
  | { type: 'SNAPSHOT'; snap: CursorSnapshot; agentEvent?: 'agent:busy' | 'agent:idle' | null }
  | { type: 'CHAT_LOADED'; chat: ChatDetailResponse; sig: string }
  | { type: 'SELECT_CHAT'; composerId: string | null }
  | { type: 'SET_CHATS'; chats: ChatSummary[]; partial?: boolean; loading?: boolean }
  | { type: 'WS_FILTER'; value: string }
  | { type: 'CDP_WINDOW'; title: string }
  | { type: 'STATUS'; text: string; loading?: boolean }
  | { type: 'SEND_START' }
  | { type: 'SEND_END' }
  | { type: 'SET_AGENT'; agent: AgentState | null };
