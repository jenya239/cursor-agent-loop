import path from 'path';
import type { ChatSummary } from '../db/types';
import type { CdpTarget } from './client';

export function workspaceHintsFromChat(
  chat?: Pick<ChatSummary, 'workspacePath' | 'workspaceLabel'>
): string[] {
  if (!chat) return [];
  const hints = new Set<string>();
  const label = chat.workspaceLabel?.trim();
  if (label && label !== '—' && label !== 'no project') hints.add(label);
  const p = chat.workspacePath?.replace(/\/$/, '') || '';
  if (p) {
    const base = path.basename(p);
    if (base.length >= 2) hints.add(base);
  }
  return [...hints];
}

export function filterTargetsByHints(targets: CdpTarget[], hints: string[]): CdpTarget[] {
  if (!hints.length) return targets;
  const hit = targets.filter((t) => {
    const title = (t.title || '').toLowerCase();
    return hints.some((h) => title.includes(h.toLowerCase()));
  });
  return hit;
}

/** Cursor 3 dedicated Agents window (title is not workspace-scoped). */
export function isAgentsWindowTitle(title?: string): boolean {
  return /^Cursor Agents\b/i.test((title || '').trim());
}

export function composerIdsMatch(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x === y) return true;
  const short = y.slice(0, 8);
  return short.length >= 8 && (x.startsWith(short) || y.startsWith(x.slice(0, 8)));
}
