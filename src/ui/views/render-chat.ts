import type { ChatMessage } from '../../db/types';
import type { ChatDetailResponse } from '../api/types';
import { esc, shortPath } from './dom';

function tag(m: ChatMessage): string {
  if (m.role === 'user') return 'u';
  return (m.text || '').startsWith('[') ? 't' : 'a';
}

export function renderChatHtml(data: ChatDetailResponse): string {
  const ws = data.workspacePath
    ? `<span class="chat-ws">${esc(shortPath(data.workspacePath))}</span> `
    : data.workspaceLabel
      ? `<span class="chat-ws">${esc(data.workspaceLabel)}</span> `
      : '';
  const title = esc(data.name || data.summary?.name || '—');
  const busy =
    data.agentBusy || data.agent?.busy
      ? '<span class="agent-busy" title="agent running">AGENT</span> '
      : '';
  const body = (data.messages || [])
    .map(
      (m) =>
        `<article class="msg ${m.role}${(m.text || '').startsWith('[') ? ' tool' : ''}"><span class="tag">${tag(m)}</span><pre>${esc(m.text || '')}</pre></article>`
    )
    .join('');
  return `<div class="chat-hdr">${ws}${title} ${busy}<span class="msg-count">${(data.messages || []).length}</span></div>${body || '<p class="hint">empty</p>'}<div id="chat-end" aria-hidden="true"></div>`;
}
