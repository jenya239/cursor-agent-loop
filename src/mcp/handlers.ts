import type { CursorSnapshot } from '../cursor/types';
import type { ChatDetailView } from '../cursor/types';
import type { ChatSummary } from '../db/types';
import type { AgentResolve } from '../cursor/resolve-agent-token';
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
  'cursor_agent_register',
  'cursor_agent_resolve',
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

function parseToken(args: Record<string, unknown>): string | null {
  const t = typeof args.token === 'string' ? args.token.trim() : '';
  return t || null;
}

function parseComposerId(args: Record<string, unknown>): string | undefined {
  const c = typeof args.composerId === 'string' ? args.composerId.trim() : '';
  return c || undefined;
}

export interface CrMcpDeps {
  listChats(): { chats: ChatSummary[]; partial: boolean };
  getChatByToken(token: string, fresh?: boolean): Promise<ChatDetailView | null>;
  snapshotByToken(token: string, opts?: { includeChats?: boolean }): Promise<CursorSnapshot>;
  send(
    text: string,
    opts: { token: string; windowTitle?: string; composerId?: string }
  ): Promise<{ ok: true; text: string; pageTitle: string }>;
  enqueueSend(
    text: string,
    opts: { token: string; windowTitle?: string; composerId?: string }
  ): Promise<{ id: string; position: number; text: string; native?: boolean; pageTitle?: string }>;
  registerAgentToken(opts?: {
    composerId?: string;
  }): Promise<{ token: string; kind: string; v: number; hint: string; composerId?: string }>;
  resolveAgentToken(token: string, composerId?: string): Promise<AgentResolve | null>;
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
          case 'cursor_agent_register':
            return ok(await deps.registerAgentToken({ composerId: parseComposerId(args) }));
          case 'cursor_agent_resolve': {
            const token = parseToken(args);
            if (!token) return err('token required');
            await deps.refreshDb();
            const resolved = await deps.resolveAgentToken(token, parseComposerId(args));
            if (!resolved) {
              return err(
                'token not found in any chat history — wait until cursor_agent_register result appears in this chat, then retry'
              );
            }
            return ok(resolved);
          }
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
            const token = parseToken(args);
            if (!token) return err('token required');
            const fresh = args.fresh === true || args.fresh === 'true';
            await deps.refreshDb();
            const view = await deps.getChatByToken(token, fresh);
            if (!view) {
              return err(
                'token not found in chat history — register first or wait for register result in DB'
              );
            }
            const messageLimit = parseLimit(args.messageLimit, MCP_DEFAULT_MSG_LIMIT, 500);
            const { messages, total, truncated } = trimMessages(view.messages, messageLimit);
            return ok({
              summary: view.summary,
              composerId: view.composerId,
              token,
              messages,
              agent: view.agent,
              messageTotal: total,
              messageTruncated: truncated,
            });
          }
          case 'cursor_snapshot': {
            const token = parseToken(args);
            if (!token) return err('token required');
            const includeChats =
              args.includeChats === true || args.includeChats === 'true' || args.includeChats === 1;
            await deps.refreshDb();
            const snap = await deps.snapshotByToken(token, { includeChats });
            if (snap.chats && snap.chats.length > MCP_MAX_LIST_LIMIT) {
              snap.chats = snap.chats.slice(0, MCP_MAX_LIST_LIMIT);
              (snap as { chatsTruncated?: boolean }).chatsTruncated = true;
            }
            return ok(snap);
          }
          case 'cursor_send': {
            const text = typeof args.text === 'string' ? args.text.trim() : '';
            if (!text) return err('text required');
            const token = parseToken(args);
            if (!token) return err('token required');
            const windowTitle =
              typeof args.windowTitle === 'string' ? args.windowTitle : undefined;
            const composerId = parseComposerId(args);
            const immediate = args.immediate === true || args.immediate === 'true';
            if (immediate && args.queue !== true && args.queue !== 'true') {
              try {
                return ok(await deps.send(text, { token, windowTitle, composerId }));
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                return err(msg);
              }
            }
            return ok(await deps.enqueueSend(text, { token, windowTitle, composerId }));
          }
          case 'cursor_enqueue_send': {
            const text = typeof args.text === 'string' ? args.text.trim() : '';
            if (!text) return err('text required');
            const token = parseToken(args);
            if (!token) return err('token required');
            const windowTitle =
              typeof args.windowTitle === 'string' ? args.windowTitle : undefined;
            const composerId = parseComposerId(args);
            return ok(await deps.enqueueSend(text, { token, windowTitle, composerId }));
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
