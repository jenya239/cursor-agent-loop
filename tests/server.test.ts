import request from 'supertest';
import { CursorDbReader } from '../src/db/reader';
import { createApp } from '../src/server';
import { ChatStore } from '../src/chat-store';
import { CursorMock } from '../src/cdp/cursor-mock';
import { createTestDb, removeTestDb, COMPOSER_ID, BUSY_COMPOSER_ID } from './fixture';

const noCdp = { cdp: CursorMock.port('idle') };

describe('HTTP API', () => {
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

  it('GET /api/status', async () => {
    const app = createApp(store, noCdp);
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.count).toBeGreaterThan(0);
  });

  it('GET /api/chats', async () => {
    const app = createApp(store);
    const res = await request(app).get('/api/chats');
    expect(res.status).toBe(200);
    expect(res.body.chats.some((c: { composerId: string }) => c.composerId === COMPOSER_ID)).toBe(true);
  });

  it('GET /api/chats/:id', async () => {
    const app = createApp(store, noCdp);
    const res = await request(app).get(`/api/chats/${COMPOSER_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.messages[0].text).toBe('Hello');
    expect(res.body.agentBusy).toBe(false);
  });

  it('GET /api/chats/:id reports agentBusy', async () => {
    const app = createApp(store, noCdp);
    const res = await request(app).get(`/api/chats/${BUSY_COMPOSER_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.agentBusy).toBe(true);
  });

  it('GET /api/chats/:id 404', async () => {
    const app = createApp(store, noCdp);
    const res = await request(app).get('/api/chats/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('GET /api/cursor/snapshot without chats by default', async () => {
    const app = createApp(store, noCdp);
    const res = await request(app).get(`/api/cursor/snapshot?composerId=${BUSY_COMPOSER_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.chats).toBeUndefined();
    expect(res.body.agent.busy).toBe(true);
    expect(res.body.cdp.ok).toBe(true);
    expect(res.body.switch).toBeDefined();
  });

  it('GET /api/cursor/snapshot includeChats=1', async () => {
    const app = createApp(store, noCdp);
    const res = await request(app).get(
      `/api/cursor/snapshot?composerId=${BUSY_COMPOSER_ID}&includeChats=1`
    );
    expect(res.status).toBe(200);
    expect(res.body.chats.length).toBeGreaterThan(0);
  });

  it('GET /api/db', async () => {
    const app = createApp(store, noCdp);
    const res = await request(app).get('/api/db');
    expect(res.status).toBe(200);
    expect(res.body.path).toContain('.vscdb');
  });

  it('POST /api/send validates text', async () => {
    jest.useFakeTimers({ legacyFakeTimers: true });
    const app = createApp(store, { ...noCdp, send: async (t) => ({ ok: true, text: t }) });
    const bad = await request(app).post('/api/send').send({ text: '  ' });
    expect(bad.status).toBe(400);
    const ok = await request(app).post('/api/send').send({ text: 'hi' });
    expect(ok.status).toBe(200);
    expect(ok.body.text).toBe('hi');
    jest.runAllTimers();
    jest.useRealTimers();
  });
});
