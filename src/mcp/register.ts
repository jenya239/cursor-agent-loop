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
    'cursor_agent_register',
    'Issue agent token; binds to composerId arg, CR_AGENT_COMPOSER_ID, or CDP active composer',
    { composerId: z.string().optional() },
    wrap('cursor_agent_register')
  );

  server.tool(
    'cursor_agent_resolve',
    'Resolve token to composerId from vscdb, server bind, or composerId arg',
    { token: z.string(), composerId: z.string().optional() },
    wrap('cursor_agent_resolve')
  );

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
    'Get chat messages by agent token',
    {
      token: z.string(),
      fresh: z.boolean().optional(),
      messageLimit: z.number().optional(),
    },
    wrap('cursor_get_chat')
  );

  server.tool(
    'cursor_snapshot',
    'Live CDP snapshot for composer identified by token',
    { token: z.string(), includeChats: z.boolean().optional() },
    wrap('cursor_snapshot')
  );

  server.tool(
    'cursor_send',
    'Send; busy → server queue (deferred). immediate:true for CDP while busy (modal risk)',
    {
      token: z.string(),
      text: z.string(),
      windowTitle: z.string().optional(),
      composerId: z.string().optional(),
      queue: z.boolean().optional(),
      immediate: z.boolean().optional(),
    },
    wrap('cursor_send')
  );

  server.tool(
    'cursor_enqueue_send',
    'Queue message to composer identified by token',
    {
      token: z.string(),
      text: z.string(),
      windowTitle: z.string().optional(),
      composerId: z.string().optional(),
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

  server.tool(
    'cursor_session',
    'Composer session: agent state, queue, modal (by token or composerId)',
    { token: z.string().optional(), composerId: z.string().optional() },
    wrap('cursor_session')
  );

  server.tool('cursor_db_info', 'Current state.vscdb path used by cr', {}, wrap('cursor_db_info'));

  server.tool(
    'cursor_supervisor',
    'Overnight supervisor alerts; blocked = critical codes for target',
    { target: z.enum(['mlc', 'cr']).optional(), refresh: z.boolean().optional() },
    wrap('cursor_supervisor')
  );

  server.tool(
    'cursor_agent_next',
    'Next ROLE/STEP from TRACK rotation (mlc|cr|all). includePrompt+token for nudge text',
    {
      target: z.enum(['mlc', 'cr', 'all']).optional(),
      token: z.string().optional(),
      includePrompt: z.boolean().optional(),
    },
    wrap('cursor_agent_next')
  );

  server.tool(
    'cursor_usage',
    'Composer context ring usage per window (CDP probe)',
    {},
    wrap('cursor_usage')
  );

  server.tool(
    'cursor_overnight_state',
    'Guard cooldown state + tail of overnight log',
    { tail: z.number().optional() },
    wrap('cursor_overnight_state')
  );

  server.tool(
    'cursor_agent_state',
    'Agent phase, turn verify, transition log (~/.cursor/cr-agent-state.json)',
    { target: z.enum(['mlc', 'cr']).optional(), refresh: z.boolean().optional() },
    wrap('cursor_agent_state')
  );
}

export function createCrMcpServer(deps: CrMcpDeps): McpServer {
  const server = new McpServer(
    { name: 'cr-cursor', version: '0.1.0' },
    {
      instructions:
        'Agent identity: 1) cursor_agent_register 2) cursor_agent_resolve(token) 3) cursor_enqueue_send/send with token. Orchestration: cursor_supervisor, cursor_agent_next, cursor_agent_state, cursor_usage, cursor_overnight_state (no token). Health before enqueue: cursor_session + cursor_usage.',
    }
  );
  registerCrMcpTools(server, deps);
  return server;
}
