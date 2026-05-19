import type { CursorSnapshot } from '../cursor/types';
import type { ChatDetailView } from '../cursor/types';
import type { ChatSummary } from '../db/types';
import {
  MCP_DEFAULT_LIST_LIMIT,
  MCP_DEFAULT_MSG_LIMIT,
  MCP_MAX_LIST_LIMIT,
  mcpJson,
  parseLimit,
  parseOffset,
  trimMessages,
} from './serialize';

export const MCP_TOOL_NAMES = [
  'cursor_list_chats',
  'cursor_get_chat',
  'cursor_snapshot',
  'cursor_send',
  'cursor_enqueue_send',
  'cursor_send_queue_list',
  'cursor_send_queue_flush',
  'cursor_refresh_db',
  'cursor_cdp_status',
  'cursor_db_info',
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

export interface CrMcpDeps {
  listChats(): { chats: ChatSummary[]; partial: boolean };
  getChat(composerId: string, fresh?: boolean): Promise<ChatDetailView | null>;
  snapshot(
    composerId?: string,
    opts?: { includeChats?: boolean }
  ): Promise<CursorSnapshot>;
  send(
    text: string,
    opts?: { composerId?: string; windowTitle?: string }
  ): Promise<{ ok: true; text: string; pageTitle: string }>;
  enqueueSend(
    text: string,
    opts?: { composerId?: string; windowTitle?: string }
  ): Promise<{ id: string; position: number; text: string; native?: boolean; pageTitle?: string }>;
  listSendQueue(): import('../send-queue').QueuedSend[];
  drainSendQueue(): Promise<{ sent: number; remaining: number; lastPageTitle?: string }>;
  refreshDb(): Promise<{
    ready: boolean;
    count: number;
    loading: boolean;
    partial: boolean;
  }>;
  cdpStatus(): Promise<{ ok: boolean; url: string }>;
  dbInfo(): { path: string };
}

export interface McpToolResult {
  text: string;
  isError?: boolean;
}

function ok(data: unknown): McpToolResult {
  return { text: mcpJson(data) };
}

function err(message: string): McpToolResult {
  return { text: message, isError: true };
}

export function createCrMcpHandlers(deps: CrMcpDeps) {
  return {
    async handleTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
      try {
        switch (name as McpToolName) {
          case 'cursor_list_chats': {
            const { chats, partial } = deps.listChats();
            const ws = typeof args.workspace === 'string' ? args.workspace : '';
            const filtered = ws
              ? chats.filter(
                  (c) =>
                    c.workspaceId === ws ||
                    c.workspaceLabel === ws ||
                    c.workspacePath === ws
                )
              : chats;
            const limit = parseLimit(args.limit, MCP_DEFAULT_LIST_LIMIT, MCP_MAX_LIST_LIMIT);
            const offset = parseOffset(args.offset);
            const page = filtered.slice(offset, offset + limit);
            return ok({
              chats: page,
              partial,
              total: filtered.length,
              limit,
              offset,
              truncated: offset + limit < filtered.length,
            });
          }
          case 'cursor_get_chat': {
            const composerId = String(args.composerId || '');
            if (!composerId) return err('composerId required');
            const fresh = args.fresh === true || args.fresh === 'true';
            const view = await deps.getChat(composerId, fresh);
            if (!view) return err('chat not found');
            const messageLimit = parseLimit(args.messageLimit, MCP_DEFAULT_MSG_LIMIT, 500);
            const { messages, total, truncated } = trimMessages(view.messages, messageLimit);
            return ok({
              summary: view.summary,
              composerId: view.composerId,
              messages,
              agent: view.agent,
              messageTotal: total,
              messageTruncated: truncated,
            });
          }
          case 'cursor_snapshot': {
            const composerId =
              typeof args.composerId === 'string' ? args.composerId : undefined;
            const includeChats =
              args.includeChats === true || args.includeChats === 'true' || args.includeChats === 1;
            const snap = await deps.snapshot(composerId, { includeChats });
            if (snap.chats && snap.chats.length > MCP_MAX_LIST_LIMIT) {
              snap.chats = snap.chats.slice(0, MCP_MAX_LIST_LIMIT);
              (snap as { chatsTruncated?: boolean }).chatsTruncated = true;
            }
            return ok(snap);
          }
          case 'cursor_send': {
            const text = typeof args.text === 'string' ? args.text.trim() : '';
            if (!text) return err('text required');
            const composerId =
              typeof args.composerId === 'string' ? args.composerId : undefined;
            const windowTitle =
              typeof args.windowTitle === 'string' ? args.windowTitle : undefined;
            if (args.queue === true || args.queue === 'true') {
              return ok(await deps.enqueueSend(text, { composerId, windowTitle }));
            }
            try {
              return ok(await deps.send(text, { composerId, windowTitle }));
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              if (
                (args.queueOnBusy === true || args.queueOnBusy === 'true') &&
                msg.includes('агент сейчас работает')
              ) {
                return ok(await deps.enqueueSend(text, { composerId, windowTitle }));
              }
              return err(msg);
            }
          }
          case 'cursor_enqueue_send': {
            const text = typeof args.text === 'string' ? args.text.trim() : '';
            if (!text) return err('text required');
            return ok(
              await deps.enqueueSend(text, {
                composerId:
                  typeof args.composerId === 'string' ? args.composerId : undefined,
                windowTitle:
                  typeof args.windowTitle === 'string' ? args.windowTitle : undefined,
              })
            );
          }
          case 'cursor_send_queue_list':
            return ok({ items: deps.listSendQueue() });
          case 'cursor_send_queue_flush':
            return ok(await deps.drainSendQueue());
          case 'cursor_refresh_db':
            return ok(await deps.refreshDb());
          case 'cursor_cdp_status':
            return ok(await deps.cdpStatus());
          case 'cursor_db_info':
            return ok(deps.dbInfo());
          default:
            return err(`unknown tool: ${name}`);
        }
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  };
}
