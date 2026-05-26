import { CursorMock } from '../../src/cdp/cursor-mock';
import { ChatStore } from '../../src/chat-store';
import { CursorModel } from '../../src/cursor/cursor-model';
import { CursorDbReader } from '../../src/db/reader';
import { createCrMcpHandlers, MCP_TOOL_NAMES } from '../../src/mcp/handlers';
import type { CrMcpDeps } from '../../src/mcp/handlers';
import Database from 'better-sqlite3';
import { createTestDb, removeTestDb, COMPOSER_ID } from '../fixture';
import { seedRegisterBubble } from '../fixtures/agent-token-db';

const TOKEN = 'cr-agent-44444444-4444-4444-4444-444444444444';

function depsFrom(store: ChatStore, cdp = CursorMock.port('idle')): CrMcpDeps {
  const cursor = new CursorModel(store, cdp);
  return {
    listChats: () => store.getChats(),
    getChatByToken: (token, fresh) => cursor.getChatByToken(token, fresh),
    snapshotByToken: (token, o) => cursor.snapshotByToken(token, o),
    send: (text, o) => cursor.send(text, o),
    enqueueSend: (text, o) => cursor.enqueueSend(text, o),
    registerAgentToken: () => cursor.registerAgentToken(),
    resolveAgentToken: (token) => cursor.resolveAgentToken(token),
    listSendQueue: () => cursor.listSendQueue(),
    drainSendQueue: () => cursor.drainSendQueue(),
    refreshDb: async () => {
      await store.refresh();
      const st = store.status();
      return { ready: st.ready, count: st.count, loading: st.loading, partial: st.partial };
    },
    cdpStatus: async () => ({ ok: true, url: 'http://127.0.0.1:9226' }),
    dbInfo: () => ({ path: store.dbPath }),
  };
}

describe('MCP handlers', () => {
  let dbPath: string;
  let reader: CursorDbReader;
  let store: ChatStore;

  beforeEach(async () => {
    dbPath = createTestDb();
    reader = CursorDbReader.fromPath(dbPath);
    store = new ChatStore(reader, dbPath, true);
    await store.refresh();
  });

  afterEach(() => {
    reader.close();
    removeTestDb(dbPath);
  });

  it('exports expected tool names', () => {
    expect(MCP_TOOL_NAMES).toContain('cursor_agent_register');
    expect(MCP_TOOL_NAMES).toContain('cursor_agent_resolve');
    expect(MCP_TOOL_NAMES).toContain('cursor_enqueue_send');
    expect(MCP_TOOL_NAMES).not.toContain('cursor_enqueue_self');
    expect(MCP_TOOL_NAMES).not.toContain('cursor_active_composer');
  });

  it('cursor_list_chats returns chats from db', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('cursor_list_chats', {});
    expect(r.isError).toBeFalsy();
    const body = JSON.parse(r.text);
    expect(body.chats.length).toBeGreaterThan(0);
  });

  it('cursor_agent_register returns token', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('cursor_agent_register', {});
    const body = JSON.parse(r.text);
    expect(body.token).toMatch(/^cr-agent-/);
  });

  it('cursor_agent_resolve requires token', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('cursor_agent_resolve', {});
    expect(r.isError).toBe(true);
  });

  it('cursor_agent_resolve finds token in db', async () => {
    const db = new Database(dbPath);
    seedRegisterBubble(db, COMPOSER_ID, TOKEN);
    db.close();
    await store.refresh();
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('cursor_agent_resolve', { token: TOKEN });
    expect(r.isError).toBeFalsy();
    const body = JSON.parse(r.text);
    expect(body.composerId).toBe(COMPOSER_ID);
  });

  it('cursor_enqueue_send requires token', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('cursor_enqueue_send', { text: 'q' });
    expect(r.isError).toBe(true);
  });

  it('cursor_enqueue_send with token', async () => {
    const db = new Database(dbPath);
    seedRegisterBubble(db, COMPOSER_ID, TOKEN);
    db.close();
    await store.refresh();
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('cursor_enqueue_send', { text: 'q', token: TOKEN });
    expect(r.isError).toBeFalsy();
    const body = JSON.parse(r.text);
    expect(body.text).toBe('q');
  });

  it('unknown tool is error', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('nope', {});
    expect(r.isError).toBe(true);
  });
});
