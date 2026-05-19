import { CursorDbReader } from '../../src/db/reader';
import { ChatStore } from '../../src/chat-store';
import { CursorModel } from '../../src/cursor/cursor-model';
import { CursorMock } from '../../src/cdp/cursor-mock';
import { createTestDb, removeTestDb, BUSY_COMPOSER_ID } from '../fixture';

describe('CursorModel', () => {
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

  it('snapshot includes agent for composer', async () => {
    const m = new CursorModel(store, CursorMock.port('idle'));
    const s = await m.snapshot(BUSY_COMPOSER_ID);
    expect(s.agent.busy).toBe(true);
    expect(s.cdp.ok).toBe(true);
    expect(s.chats).toBeUndefined();
    const full = await m.snapshot(BUSY_COMPOSER_ID, { includeChats: true });
    expect(full.chats!.length).toBeGreaterThan(0);
    expect(s.switch?.ok).toBe(true);
  });

  it('chat returns null for unknown id', async () => {
    const m = new CursorModel(store, CursorMock.port('idle'));
    expect(await m.chat('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
