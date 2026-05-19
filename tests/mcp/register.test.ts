/** @jest-environment node */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createCrMcpServer } from '../../src/mcp/register';
import type { CrMcpDeps } from '../../src/mcp/handlers';

const stub: CrMcpDeps = {
  listChats: () => ({ chats: [], partial: false }),
  getChat: async () => null,
  snapshot: async () => ({
    at: 0,
    cdp: { ok: false },
    windows: [],
    composerByWindow: [],
    agent: {
      phase: 'unknown',
      busy: false,
      dbBusy: false,
      cdpBusy: false,
      cdpOk: false,
      at: 0,
    },
    switch: null,
  }),
  send: async (text) => ({ ok: true, text, pageTitle: 'x' }),
  enqueueSend: async (text) => ({ id: '1', text, position: 0, native: true }),
  listSendQueue: () => [],
  drainSendQueue: async () => ({ sent: 0, remaining: 0 }),
  refreshDb: async () => ({ ready: true, count: 0, loading: false, partial: false }),
  cdpStatus: async () => ({ ok: false, url: '' }),
  dbInfo: () => ({ path: '/tmp/x.vscdb' }),
};

describe('createCrMcpServer', () => {
  it('creates McpServer instance', () => {
    const s = createCrMcpServer(stub);
    expect(s).toBeInstanceOf(McpServer);
  });
});
