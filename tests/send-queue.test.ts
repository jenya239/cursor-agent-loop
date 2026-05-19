import { CursorDbReader } from '../src/db/reader';
import { ChatStore } from '../src/chat-store';
import { CursorModel } from '../src/cursor/cursor-model';
import { CursorMock } from '../src/cdp/cursor-mock';
import { SendQueue } from '../src/send-queue';
import { createTestDb, removeTestDb } from './fixture';

describe('SendQueue', () => {
  it('enqueue and list', () => {
    const q = new SendQueue();
    const a = q.enqueue('one', { composerId: 'x' });
    expect(q.length).toBe(1);
    expect(q.list()[0].id).toBe(a.id);
  });
});

describe('CursorModel queue', () => {
  let dbPath: string;
  let reader: CursorDbReader;

  beforeEach(async () => {
    dbPath = createTestDb();
    reader = CursorDbReader.fromPath(dbPath);
  });

  afterEach(() => {
    reader.close();
    removeTestDb(dbPath);
  });

  it('native enqueue when busy (no server backlog)', async () => {
    const store = new ChatStore(reader, dbPath, true);
    await store.refresh();
    const m = new CursorModel(store, CursorMock.port('send-blocked'));
    const r = await m.enqueueSend('native');
    expect(r.native).toBe(true);
    expect(m.listSendQueue()).toHaveLength(0);
  });

  it('fallback server queue when cdp down', async () => {
    const store = new ChatStore(reader, dbPath, true);
    await store.refresh();
    const m = new CursorModel(store, CursorMock.port('down'));
    const r = await m.enqueueSend('fallback');
    expect(r.native).toBeUndefined();
    expect(m.listSendQueue()).toHaveLength(1);
  });
});
