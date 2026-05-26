import Database from 'better-sqlite3';
import { CursorDbReader } from '../../src/db/reader';
import { ChatStore } from '../../src/chat-store';
import { CursorModel } from '../../src/cursor/cursor-model';
import { CursorMock } from '../../src/cdp/cursor-mock';
import { createTestDb, removeTestDb, COMPOSER_ID, COMPOSER_ID_2 } from '../fixture';
import { seedRegisterBubble } from '../fixtures/agent-token-db';

const TOKEN_CR = 'cr-agent-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TOKEN_2 = 'cr-agent-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('CursorModel.send', () => {
  let dbPath: string;
  let reader: CursorDbReader;
  let store: ChatStore;

  beforeEach(async () => {
    dbPath = createTestDb();
    const db = new Database(dbPath);
    seedRegisterBubble(db, COMPOSER_ID, TOKEN_CR);
    seedRegisterBubble(db, COMPOSER_ID_2, TOKEN_2);
    db.close();
    reader = CursorDbReader.fromPath(dbPath);
    store = new ChatStore(reader, dbPath, true);
    await store.refresh();
  });

  afterEach(() => {
    reader.close();
    removeTestDb(dbPath);
  });

  it('sends via fixture cdp', async () => {
    const m = new CursorModel(store, CursorMock.port('idle'));
    const r = await m.send('hi', { token: TOKEN_CR });
    expect(r.text).toBe('hi');
  });

  it('switch-fail throws when strict', async () => {
    const m = new CursorModel(store, CursorMock.port('switch-fail'));
    await expect(m.send('hi', { token: TOKEN_2 })).rejects.toThrow(/switch failed/);
  });

  it('switch-fail allowed when CR_SEND_STRICT=0', async () => {
    process.env.CR_SEND_STRICT = '0';
    jest.resetModules();
    const { CursorModel: M } = await import('../../src/cursor/cursor-model');
    const m = new M(store, CursorMock.port('switch-fail'));
    const r = await m.send('hi', { token: TOKEN_2 });
    expect(r.text).toBe('hi');
    delete process.env.CR_SEND_STRICT;
    jest.resetModules();
  });
});
