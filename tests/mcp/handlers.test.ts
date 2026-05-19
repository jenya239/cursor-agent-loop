import { CursorMock } from '../../src/cdp/cursor-mock';
import { ChatStore } from '../../src/chat-store';
import { CursorModel } from '../../src/cursor/cursor-model';
import { CursorDbReader } from '../../src/db/reader';
import { createCrMcpHandlers, MCP_TOOL_NAMES } from '../../src/mcp/handlers';
import type { CrMcpDeps } from '../../src/mcp/handlers';
import { createTestDb, removeTestDb, COMPOSER_ID } from '../fixture';

function depsFrom(store: ChatStore, cdp = CursorMock.port('idle')): CrMcpDeps {
  const cursor = new CursorModel(store, cdp);
  return {
    listChats: () => store.getChats(),
    getChat: (id, fresh) => cursor.chat(id, fresh),
    snapshot: (id, opts) => cursor.snapshot(id, opts),
    send: (text, opts) => cursor.send(text, opts),
    enqueueSend: (text, opts) => cursor.enqueueSend(text, opts),
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
    expect(MCP_TOOL_NAMES).toContain('cursor_list_chats');
    expect(MCP_TOOL_NAMES).toContain('cursor_send');
    expect(MCP_TOOL_NAMES.length).toBeGreaterThanOrEqual(6);
  });

  it('cursor_list_chats returns chats from db', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('cursor_list_chats', {});
    const body = JSON.parse(r.text);
    expect(body.chats.some((c: { composerId: string }) => c.composerId === COMPOSER_ID)).toBe(true);
    expect(r.isError).toBeFalsy();
  });

  it('cursor_get_chat returns messages', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('cursor_get_chat', { composerId: COMPOSER_ID });
    const body = JSON.parse(r.text);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].text).toBe('Hello');
    expect(body.messageTotal).toBe(2);
  });

  it('cursor_list_chats respects limit', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const all = JSON.parse((await h.handleTool('cursor_list_chats', {})).text);
    const r = await h.handleTool('cursor_list_chats', { limit: 1, offset: 0 });
    const body = JSON.parse(r.text);
    expect(body.chats).toHaveLength(1);
    expect(body.limit).toBe(1);
    expect(body.total).toBe(all.total);
    expect(body.truncated).toBe(all.total > 1);
  });

  it('cursor_get_chat unknown id is error', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('cursor_get_chat', {
      composerId: '00000000-0000-0000-0000-000000000000',
    });
    expect(r.isError).toBe(true);
  });

  it('cursor_snapshot has no chats by default', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('cursor_snapshot', { composerId: COMPOSER_ID });
    const body = JSON.parse(r.text);
    expect(body.cdp.ok).toBe(true);
    expect(body.chats).toBeUndefined();
    expect(body.switch).toBeDefined();
  });

  it('cursor_send rejects empty text', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('cursor_send', { text: '  ', composerId: COMPOSER_ID });
    expect(r.isError).toBe(true);
  });

  it('cursor_send with mock cdp', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('cursor_send', { text: 'hi', composerId: COMPOSER_ID });
    const body = JSON.parse(r.text);
    expect(body.ok).toBe(true);
    expect(body.text).toBe('hi');
  });

  it('cursor_enqueue_send', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('cursor_enqueue_send', {
      text: 'q',
      composerId: COMPOSER_ID,
    });
    const body = JSON.parse(r.text);
    expect(body.native).toBe(true);
    expect(body.text).toBe('q');
  });

  it('unknown tool is error', async () => {
    const h = createCrMcpHandlers(depsFrom(store));
    const r = await h.handleTool('nope', {});
    expect(r.isError).toBe(true);
  });
});
