import type { BubblePayload, ComposerData } from './types';
import {
  REGISTER_TOOL_NAME,
  isValidAgentToken,
  tokenFromRegisterToolResult,
} from '../cursor/agent-token';
import type { CursorDbReader } from './reader';

export type FindTokenResult =
  | { ok: true; composerId: string }
  | { ok: false; reason: 'not_found' | 'ambiguous' | 'invalid_token'; composerIds?: string[] };

/** Token issued by cursor_agent_register tool result in this bubble (not plain-text mention). */
export function bubbleContainsToken(b: BubblePayload | null | undefined, token: string): boolean {
  if (!token || !isValidAgentToken(token)) return false;
  const tf = b?.toolFormerData;
  if (tf?.name !== REGISTER_TOOL_NAME) return false;
  return tokenFromRegisterToolResult(tf.result) === token;
}

function composerHasToken(
  data: ComposerData,
  reader: CursorDbReader,
  composerId: string,
  token: string
): boolean {
  const headers = data.fullConversationHeadersOnly ?? [];
  const map = data.conversationMap ?? {};
  for (const h of headers) {
    const b = map[h.bubbleId] ?? reader.getBubble(composerId, h.bubbleId);
    if (bubbleContainsToken(b, token)) return true;
  }
  return false;
}

export function findComposerByToken(reader: CursorDbReader, token: string): FindTokenResult {
  if (!isValidAgentToken(token)) {
    return { ok: false, reason: 'invalid_token' };
  }
  const hits: string[] = [];
  for (const chat of reader.listChats()) {
    const data = reader.getComposerData(chat.composerId);
    if (data && composerHasToken(data, reader, chat.composerId, token)) {
      hits.push(chat.composerId);
    }
  }
  if (!hits.length) return { ok: false, reason: 'not_found' };
  if (hits.length > 1) return { ok: false, reason: 'ambiguous', composerIds: hits };
  return { ok: true, composerId: hits[0] };
}
