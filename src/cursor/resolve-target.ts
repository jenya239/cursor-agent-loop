import type { CursorDbReader } from '../db/reader';
import { findComposerByToken } from '../db/token-scan';
import { resolveBoundComposer } from '../cursor/token-bind';

export async function resolveSendTarget(
  _cdp: unknown,
  opts: { token: string; composerId?: string; db: CursorDbReader }
): Promise<{ composerId: string; resolved: 'token' | 'bind' | 'composerId' }> {
  const token = opts.token?.trim();
  if (!token) throw new Error('token required');
  const explicit = opts.composerId?.trim();
  if (explicit) {
    return { composerId: explicit, resolved: 'composerId' };
  }
  const hit = findComposerByToken(opts.db, token);
  if (hit.ok) {
    return { composerId: hit.composerId, resolved: 'token' };
  }
  if (hit.reason === 'ambiguous') {
    throw new Error(`agent token ambiguous (${hit.composerIds?.length ?? 0} chats)`);
  }
  if (hit.reason === 'invalid_token') {
    throw new Error('invalid agent token format');
  }
  const bound = resolveBoundComposer(token);
  if (bound) {
    return { composerId: bound, resolved: 'bind' };
  }
  throw new Error(
    'agent token not found in any chat — call cursor_agent_register, wait for tool result in history, then retry'
  );
}
