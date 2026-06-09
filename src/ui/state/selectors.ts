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
  const sw = state.snapshot.switch;
  if (sw?.ok) return false;
  if (sw && !sw.ok) return true;
  const chatName = (state.chatMeta?.name || '').trim();
  const win = (state.agent?.cdpWindowTitle || '').trim();
  if (chatName && win && !win.includes(chatName) && chatName.length > 3) {
    return true;
  }
  return false;
}

export interface AgentPanelModel {
  phase: string;
  label: string;
  cdpLine: string;
  dbLine: string;
  windowLine: string;
  cdpMeta: string;
  cdpDetails: string;
  switchLine: string;
  mismatch: boolean;
  composerId: string | null;
}

function formatCdpDetails(state: UiState): string {
  const rows = state.snapshot?.composerByWindow || [];
  if (!rows.length) return '';
  return rows
    .map((w) => {
      const p = w.probe;
      const ctrl = (p.controls || [])
        .map((c) => `${c.role}${c.visible ? '' : '?'}`)
        .join(',');
      return `${w.windowTitle}: ${p.busy ? 'busy' : 'idle'}(${p.reason})${ctrl ? `[${ctrl}]` : ''}`;
    })
    .join(' | ');
}

export function agentPanelModel(state: UiState): AgentPanelModel {
  const st = state.agent;
  if (!st) {
    return {
      phase: 'unknown',
      label: 'no data',
      cdpLine: '',
      dbLine: '',
      windowLine: '',
      cdpMeta: '',
      cdpDetails: '',
      switchLine: '',
      mismatch: false,
      composerId: state.activeComposerId,
    };
  }
  const label = st.busy ? 'RUNNING' : 'IDLE';
  const cdpLine = st.cdpOk
    ? st.cdpBusy
      ? `Cursor busy (${st.cdpReason || '?'})`
      : 'Cursor free'
    : 'CDP unavailable';
  const dbLine = st.dbBusy
    ? `chat busy (${st.dbStatus || '?'})`
    : 'chat free';
  const windowLine = st.cdpWindowTitle ? ` · ${st.cdpWindowTitle}` : '';
  const n = state.snapshot?.windows?.length;
  const busyN = state.snapshot?.composerByWindow?.filter((w) => w.probe?.busy).length ?? 0;
  const cdpMeta =
    state.snapshot?.cdp?.ok && n ? ` · CDP ${n} win${busyN ? `, ${busyN} busy` : ''}` : '';
  const sw = state.snapshot?.switch;
  const switchLine = sw
    ? ` · switch: ${sw.ok ? 'ok' : 'fail'}(${sw.reason})${sw.switchTarget ? ` → ${sw.switchTarget}` : ''}`
    : '';
  const cdpDetails = formatCdpDetails(state);
  return {
    phase: st.phase,
    label,
    cdpLine,
    dbLine,
    windowLine,
    cdpMeta,
    cdpDetails,
    switchLine,
    mismatch: isComposerMismatch(state),
    composerId: state.activeComposerId,
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
