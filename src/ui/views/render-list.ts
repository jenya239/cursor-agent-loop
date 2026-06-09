import type { ChatSummary } from '../../db/types';
import { esc, shortPath } from './dom';

export function renderListHtml(chats: ChatSummary[], activeId: string | null): string {
  if (!chats.length) return '<p class="hint">No chats</p>';
  const groups = new Map<string, ChatSummary[]>();
  for (const c of chats) {
    const g = c.workspaceLabel || '—';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(c);
  }
  const labels = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
  let html = '';
  for (const label of labels) {
    const items = groups.get(label)!;
    const sample = items[0];
    const pathHint = sample.workspacePath ? shortPath(sample.workspacePath) : '';
    html += `<div class="ws-hdr" title="${esc(sample.workspacePath || '')}">${esc(label)}${pathHint ? ` <span class="ws-path">${esc(pathHint)}</span>` : ''}</div>`;
    for (const c of items) {
      const mode = (c.unifiedMode || '?').slice(0, 2);
      html += `<a class="item${c.composerId === activeId ? ' active' : ''}" href="#" data-id="${c.composerId}" title="${esc(c.name)}">
      <span class="mode">${esc(mode)}</span><span class="name">${esc(c.name)}</span></a>`;
    }
  }
  return html;
}
