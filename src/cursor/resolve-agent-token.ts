import { findComposerByToken } from '../db/token-scan';
import type { CursorDbReader } from '../db/reader';
import type { ChatSummary } from '../db/types';
import { resolveBoundComposer } from './token-bind';

export interface AgentResolve {
  token: string;
  composerId: string;
  name: string;
  workspaceLabel?: string;
  workspacePath?: string;
  unifiedMode?: string;
  resolved?: 'token' | 'bind' | 'composerId';
}

export function resolveAgentToken(
  reader: CursorDbReader,
  token: string,
  composerId?: string
): AgentResolve | null {
  const explicit = composerId?.trim();
  if (explicit) {
    const summary =
      reader.listChats().find((c) => c.composerId === explicit) ??
      ({ composerId: explicit, name: 'Untitled' } as ChatSummary);
    return {
      token,
      composerId: explicit,
      name: summary.name,
      workspaceLabel: summary.workspaceLabel,
      workspacePath: summary.workspacePath,
      unifiedMode: summary.unifiedMode,
      resolved: 'composerId',
    };
  }
  const hit = findComposerByToken(reader, token);
  if (hit.ok) {
    const summary =
      reader.listChats().find((c) => c.composerId === hit.composerId) ??
      ({
        composerId: hit.composerId,
        name: 'Untitled',
      } as ChatSummary);
    return {
      token,
      composerId: hit.composerId,
      name: summary.name,
      workspaceLabel: summary.workspaceLabel,
      workspacePath: summary.workspacePath,
      unifiedMode: summary.unifiedMode,
      resolved: 'token',
    };
  }
  if (hit.reason === 'ambiguous' || hit.reason === 'invalid_token') return null;
  const bound = resolveBoundComposer(token);
  if (!bound) return null;
  const summary =
    reader.listChats().find((c) => c.composerId === bound) ??
    ({ composerId: bound, name: 'Untitled' } as ChatSummary);
  return {
    token,
    composerId: bound,
    name: summary.name,
    workspaceLabel: summary.workspaceLabel,
    workspacePath: summary.workspacePath,
    unifiedMode: summary.unifiedMode,
    resolved: 'bind',
  };
}
