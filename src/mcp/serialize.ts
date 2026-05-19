import type { ChatMessage } from '../db/types';

export const MCP_MAX_JSON_BYTES = 480_000;
export const MCP_DEFAULT_LIST_LIMIT = 50;
export const MCP_MAX_LIST_LIMIT = 200;
export const MCP_DEFAULT_MSG_LIMIT = 40;
export const MCP_MAX_MSG_CHARS = 8000;

export function truncateText(text: string, max = MCP_MAX_MSG_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]`;
}

export function trimMessages(
  messages: ChatMessage[],
  limit: number
): { messages: ChatMessage[]; total: number; truncated: boolean } {
  const total = messages.length;
  const n = limit > 0 ? Math.min(limit, total) : total;
  const slice = n < total ? messages.slice(-n) : messages;
  return {
    messages: slice.map((m) => ({ ...m, text: truncateText(m.text) })),
    total,
    truncated: n < total,
  };
}

export function parseLimit(raw: unknown, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export function parseOffset(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function mcpJson(data: unknown, maxBytes = MCP_MAX_JSON_BYTES): string {
  let compact = JSON.stringify(data);
  if (compact.length <= maxBytes) {
    const pretty = JSON.stringify(data, null, 2);
    return pretty.length <= maxBytes ? pretty : compact;
  }
  return JSON.stringify({
    error: 'response too large',
    bytes: compact.length,
    maxBytes,
    hint: 'use limit/offset (list_chats) or messageLimit (get_chat)',
  });
}
