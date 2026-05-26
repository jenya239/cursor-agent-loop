/** @jest-environment node */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createCrMcpServer } from '../../src/mcp/register';
import type { CrMcpDeps } from '../../src/mcp/handlers';

const stub: CrMcpDeps = {
  listChats: () => ({ chats: [], partial: false }),
  getChatByToken: async () => null,
  snapshotByToken: async () => ({
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
  registerAgentToken: async () => ({
    token: 'cr-agent-11111111-1111-1111-1111-111111111111',
    kind: 'cr-agent-token',
    v: 1,
    hint: 'x',
  }),
  resolveAgentToken: async () => null,
  listSendQueue: () => [],
  drainSendQueue: async () => ({ sent: 0, remaining: 0 }),
  refreshDb: async () => ({ ready: true, count: 0, loading: false, partial: false }),
  cdpStatus: async () => ({ ok: false, url: '' }),
  sessionByToken: async () => ({
    composerId: 'x',
    agent: {
      phase: 'unknown',
      busy: false,
      dbBusy: false,
      cdpBusy: false,
      cdpOk: false,
      at: 0,
      composerId: 'x',
    },
    queueLength: 0,
    modal: 'none',
    at: 0,
  }),
  session: async (composerId) => ({
    composerId,
    agent: {
      phase: 'unknown',
      busy: false,
      dbBusy: false,
      cdpBusy: false,
      cdpOk: false,
      at: 0,
      composerId,
    },
    queueLength: 0,
    modal: 'none',
    at: 0,
  }),
  dbInfo: () => ({ path: '/tmp/x.vscdb' }),
};

describe('createCrMcpServer', () => {
  it('creates McpServer instance', () => {
    const s = createCrMcpServer(stub);
    expect(s).toBeInstanceOf(McpServer);
  });
});
