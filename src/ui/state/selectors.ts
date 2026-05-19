import type { ChatSummary } from '../../db/types';
import type { UiState } from './store';

export function filterChats(chats: ChatSummary[], wsFilter: string): ChatSummary[] {
  if (!wsFilter) return chats;
  return chats.filter(
    (c) =>
      c.workspaceId === wsFilter || c.workspaceLabel === wsFilter || c.workspacePath === wsFilter
  );
}

export function isComposerMismatch(state: UiState): boolean {
  if (!state.activeComposerId || !state.snapshot?.cdp.ok) return false;
  const win = state.agent?.cdpWindowTitle || state.cdpWindowTitle;
  if (!win) return false;
  return false;
}

export interface AgentPanelModel {
  phase: string;
  label: string;
  cdpLine: string;
  dbLine: string;
  windowLine: string;
  cdpMeta: string;
  mismatch: boolean;
}

export function agentPanelModel(state: UiState): AgentPanelModel {
  const st = state.agent;
  if (!st) {
    return {
      phase: 'unknown',
      label: 'нет данных',
      cdpLine: '',
      dbLine: '',
      windowLine: '',
      cdpMeta: '',
      mismatch: false,
    };
  }
  const label = st.busy ? 'РАБОТАЕТ' : 'ЖДЁТ';
  const cdpLine = st.cdpOk
    ? st.cdpBusy
      ? `Cursor занят (${st.cdpReason || '?'})`
      : 'Cursor свободен'
    : 'CDP недоступен';
  const dbLine = st.dbBusy
    ? `чат занят (${st.dbStatus || '?'})`
    : 'чат свободен';
  const windowLine = st.cdpWindowTitle ? ` · ${st.cdpWindowTitle}` : '';
  const n = state.snapshot?.windows?.length;
  const busyN = state.snapshot?.composerByWindow?.filter((w) => w.probe?.busy).length ?? 0;
  const cdpMeta =
    state.snapshot?.cdp?.ok && n ? ` · CDP ${n} окн${busyN ? `, ${busyN} занято` : ''}` : '';
  return {
    phase: st.phase,
    label,
    cdpLine,
    dbLine,
    windowLine,
    cdpMeta,
    mismatch: isComposerMismatch(state),
  };
}

export function workspaceOptions(chats: ChatSummary[]): { key: string; label: string; path: string }[] {
  const map = new Map<string, { key: string; label: string; path: string }>();
  for (const c of chats) {
    const key = c.workspaceId || c.workspaceLabel || '—';
    if (!map.has(key)) {
      map.set(key, { key, label: c.workspaceLabel || '—', path: c.workspacePath || '' });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

export function cdpWindowOptions(state: UiState): string[] {
  return (state.snapshot?.windows || [])
    .filter((w) => w.hasComposer || w.type === 'page')
    .map((w) => w.title);
}
