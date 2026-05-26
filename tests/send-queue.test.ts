import Database from 'better-sqlite3';
import { CursorDbReader } from '../src/db/reader';
import { ChatStore } from '../src/chat-store';
import { CursorModel } from '../src/cursor/cursor-model';
import { CursorMock } from '../src/cdp/cursor-mock';
import { SendQueue } from '../src/send-queue';
import { createTestDb, removeTestDb, COMPOSER_ID } from './fixture';
import { seedRegisterBubble } from './fixtures/agent-token-db';

const TOKEN = 'cr-agent-eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

describe('SendQueue', () => {
  it('enqueue and list', () => {
    const q = new SendQueue();
    const a = q.enqueue('one', { token: TOKEN, composerId: COMPOSER_ID });
    expect(q.length).toBe(1);
    expect(q.list()[0].id).toBe(a.id);
  });
});

describe('CursorModel queue', () => {
  let dbPath: string;
  let reader: CursorDbReader;

  beforeEach(async () => {
    dbPath = createTestDb();
    const db = new Database(dbPath);
    seedRegisterBubble(db, COMPOSER_ID, TOKEN);
    db.close();
    reader = CursorDbReader.fromPath(dbPath);
  });

  afterEach(() => {
    reader.close();
    removeTestDb(dbPath);
  });

  it('enqueue always uses server queue (drain sends later)', async () => {
    const store = new ChatStore(reader, dbPath, true);
    await store.refresh();
    const m = new CursorModel(store, CursorMock.port('idle'));
    const r = await m.enqueueSend('deferred', { token: TOKEN });
    expect(r.native).toBe(false);
    expect((r as { deferred?: boolean }).deferred).toBe(true);
    expect(m.listSendQueue()).toHaveLength(1);
  });

  it('server queue when agent busy', async () => {
    const store = new ChatStore(reader, dbPath, true);
    await store.refresh();
    const m = new CursorModel(store, CursorMock.port('send-blocked'));
    const r = await m.enqueueSend('deferred', { token: TOKEN });
    expect(r.native).toBe(false);
    expect((r as { deferred?: boolean }).deferred).toBe(true);
    expect(m.listSendQueue()).toHaveLength(1);
  });

  it('drain keeps item when send fails', async () => {
    const store = new ChatStore(reader, dbPath, true);
    await store.refresh();
    const m = new CursorModel(store, CursorMock.port('no-bar'));
    await m.enqueueSend('keep', { token: TOKEN });
    const d = await m.drainSendQueue();
    expect(d.sent).toBe(0);
    expect(m.listSendQueue()).toHaveLength(1);
  });
});
