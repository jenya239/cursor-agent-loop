import type { AgentState } from '../../agent-model';
import type { ChatMessage, ChatSummary } from '../../db/types';
import type { CursorSnapshot } from '../../cursor/types';
import type { UiAction } from './actions';
import { agentBus } from '../agent-bus';

export interface UiState {
  activeComposerId: string | null;
  chats: ChatSummary[];
  messages: ChatMessage[];
  chatMeta: ChatSummary | null;
  snapshot: CursorSnapshot | null;
  agent: AgentState | null;
  agentBusy: boolean;
  chatSig: string;
  sending: boolean;
  status: string;
  statusLoading: boolean;
  wsFilter: string;
  cdpWindowTitle: string;
  listPartial: boolean;
  listLoading: boolean;
  embedded: boolean;
  lastAgentEvent: 'agent:busy' | 'agent:idle' | null;
}

export const initialUiState = (embedded: boolean): UiState => ({
  activeComposerId: null,
  chats: [],
  messages: [],
  chatMeta: null,
  snapshot: null,
  agent: null,
  agentBusy: false,
  chatSig: '',
  sending: false,
  status: '…',
  statusLoading: true,
  wsFilter: '',
  cdpWindowTitle: '',
  listPartial: false,
  listLoading: true,
  embedded,
  lastAgentEvent: null,
});

export function reduceUi(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'SNAPSHOT':
      return {
        ...state,
        snapshot: action.snap,
        agent: action.snap.agent,
        agentBusy: action.snap.agent.busy,
        lastAgentEvent: action.agentEvent ?? state.lastAgentEvent,
      };
    case 'CHAT_LOADED': {
      const c = action.chat;
      return {
        ...state,
        messages: c.messages,
        chatMeta: {
          composerId: c.composerId,
          name: c.name || c.summary?.name || '—',
          workspacePath: c.workspacePath ?? c.summary?.workspacePath,
          workspaceLabel: c.workspaceLabel ?? c.summary?.workspaceLabel,
          unifiedMode: c.unifiedMode ?? c.summary?.unifiedMode,
        },
        agent: c.agent,
        agentBusy: !!c.agentBusy || c.agent.busy,
        chatSig: action.sig,
      };
    }
    case 'SELECT_CHAT':
      return { ...state, activeComposerId: action.composerId, chatSig: '', messages: [] };
    case 'SET_CHATS':
      return {
        ...state,
        chats: action.chats,
        listPartial: !!action.partial,
        listLoading: !!action.loading,
      };
    case 'WS_FILTER':
      return { ...state, wsFilter: action.value };
    case 'CDP_WINDOW':
      return { ...state, cdpWindowTitle: action.title };
    case 'STATUS':
      return {
        ...state,
        status: action.text,
        statusLoading: action.loading ?? state.statusLoading,
      };
    case 'SEND_START':
      return { ...state, sending: true };
    case 'SEND_END':
      return { ...state, sending: false };
    case 'SET_AGENT':
      return {
        ...state,
        agent: action.agent,
        agentBusy: !!action.agent?.busy,
      };
    default:
      return state;
  }
}

export class CrStore {
  private state: UiState;
  private readonly subs = new Set<(s: UiState) => void>();

  constructor(embedded: boolean) {
    this.state = initialUiState(embedded);
  }

  get(): UiState {
    return this.state;
  }

  dispatch(action: UiAction): void {
    this.state = reduceUi(this.state, action);
    if (action.type === 'SNAPSHOT' && action.agentEvent) {
      agentBus.emit(action.agentEvent);
    }
    for (const fn of this.subs) fn(this.state);
  }

  subscribe(fn: (s: UiState) => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }
}
