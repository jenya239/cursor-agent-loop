// MCP SDK + zod 3: tool() inference blows TS stack; handlers stay typed in handlers.ts
// @ts-nocheck
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createCrMcpHandlers, type CrMcpDeps } from './handlers';

export function registerCrMcpTools(server: McpServer, deps: CrMcpDeps): void {
  const h = createCrMcpHandlers(deps);

  const wrap = (name: string) => async (args: Record<string, unknown>) => {
    const r = await h.handleTool(name, args);
    return {
      content: [{ type: 'text', text: r.text }],
      isError: r.isError,
    };
  };

  server.tool(
    'cursor_list_chats',
    'List Cursor composer chats from state.vscdb (default limit 50)',
    {
      workspace: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    wrap('cursor_list_chats')
  );

  server.tool(
    'cursor_get_chat',
    'Get chat messages from DB (no CDP; use messageLimit for long chats)',
    {
      composerId: z.string(),
      fresh: z.boolean().optional(),
      messageLimit: z.number().optional(),
    },
    wrap('cursor_get_chat')
  );

  server.tool(
    'cursor_snapshot',
    'Live CDP snapshot: windows, agent busy, composer switch (no chat list by default)',
    { composerId: z.string().optional(), includeChats: z.boolean().optional() },
    wrap('cursor_snapshot')
  );

  server.tool(
    'cursor_send',
    'Send via CDP; queue=true to enqueue; queueOnBusy auto-enqueue when agent busy',
    {
      text: z.string(),
      composerId: z.string().optional(),
      windowTitle: z.string().optional(),
      queue: z.boolean().optional(),
      queueOnBusy: z.boolean().optional(),
    },
    wrap('cursor_send')
  );

  server.tool(
    'cursor_enqueue_send',
    'Queue in native Cursor composer (type+submit while agent busy); server fallback if CDP fails',
    {
      text: z.string(),
      composerId: z.string().optional(),
      windowTitle: z.string().optional(),
    },
    wrap('cursor_enqueue_send')
  );

  server.tool('cursor_send_queue_list', 'List pending queued sends', {}, wrap('cursor_send_queue_list'));

  server.tool(
    'cursor_send_queue_flush',
    'Try to send all queued messages now',
    {},
    wrap('cursor_send_queue_flush')
  );

  server.tool('cursor_refresh_db', 'Rescan state.vscdb and refresh chat index', {}, wrap('cursor_refresh_db'));

  server.tool('cursor_cdp_status', 'Check if Cursor remote debugging (CDP) is available', {}, wrap('cursor_cdp_status'));

  server.tool('cursor_db_info', 'Current state.vscdb path used by cr', {}, wrap('cursor_db_info'));
}

export function createCrMcpServer(deps: CrMcpDeps): McpServer {
  const server = new McpServer(
    { name: 'cr-cursor', version: '0.1.0' },
    {
      instructions:
        'Chats and messages come from state.vscdb (cursor_list_chats, cursor_get_chat). Live Cursor UI state via cursor_snapshot and cursor_send (needs CDP). Prefer cursor_list_chats over snapshot for chat lists.',
    }
  );
  registerCrMcpTools(server, deps);
  return server;
}
