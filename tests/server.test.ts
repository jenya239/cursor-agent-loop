import request from 'supertest';
import Database from 'better-sqlite3';
import { CursorDbReader } from '../src/db/reader';
import { createApp } from '../src/server';
import { ChatStore } from '../src/chat-store';
import { CursorMock } from '../src/cdp/cursor-mock';
import { createTestDb, removeTestDb, COMPOSER_ID, BUSY_COMPOSER_ID } from './fixture';
import { seedRegisterBubble } from './fixtures/agent-token-db';

const TOKEN = 'cr-agent-cccccccc-cccc-cccc-cccc-cccccccccccc';

const noCdp = { cdp: CursorMock.port('idle'), sendQueueDrain: false, watchdogStats: null };

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

  function seedToken(db = new Database(dbPath)) {
    seedRegisterBubble(db, COMPOSER_ID, TOKEN);
    db.close();
  }

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

  it('GET /api/cdp/status', async () => {
    const app = createApp(store, noCdp);
    const res = await request(app).get('/api/cdp/status');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.url).toBe('fixture://cdp');
  });

  it('GET /api/session by token', async () => {
    seedToken();
    await store.refresh();
    const app = createApp(store, noCdp);
    const res = await request(app).get(`/api/session?token=${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.composerId).toBe(COMPOSER_ID);
    expect(res.body.token).toBe(TOKEN);
  });

  it('GET /api/session by composerId', async () => {
    const app = createApp(store, noCdp);
    const res = await request(app).get(`/api/session?composerId=${COMPOSER_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.composerId).toBe(COMPOSER_ID);
  });

  it('GET /api/session 400 without params', async () => {
    const app = createApp(store, noCdp);
    const res = await request(app).get('/api/session');
    expect(res.status).toBe(400);
  });

  it('GET /api/db', async () => {
    const app = createApp(store, noCdp);
    const res = await request(app).get('/api/db');
    expect(res.status).toBe(200);
    expect(res.body.path).toContain('.vscdb');
  });

  it('POST /api/send/queue enqueues', async () => {
    seedToken();
    await store.refresh();
    const app = createApp(store, noCdp);
    const res = await request(app)
      .post('/api/send/queue')
      .send({ text: 'later', token: TOKEN });
    expect(res.status).toBe(202);
    expect(res.body.queued).toBe(true);
    expect(res.body.native).toBe(false);
    const list = await request(app).get('/api/send/queue');
    expect(list.body.items).toHaveLength(1);
  });

  it('POST /api/send validates text', async () => {
    seedToken();
    await store.refresh();
    jest.useFakeTimers({ legacyFakeTimers: true });
    const app = createApp(store, { ...noCdp, send: async (t, _token) => ({ ok: true, text: t }) });
    const bad = await request(app).post('/api/send').send({ text: '  ' });
    expect(bad.status).toBe(400);
    const noToken = await request(app).post('/api/send').send({ text: 'hi' });
    expect(noToken.status).toBe(400);
    const ok = await request(app).post('/api/send').send({ text: 'hi', token: TOKEN });
    expect(ok.status).toBe(200);
    expect(ok.body.text).toBe('hi');
    jest.runAllTimers();
    jest.useRealTimers();
  });
});
