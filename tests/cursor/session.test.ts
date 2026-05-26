import Database from 'better-sqlite3';
import { CursorDbReader } from '../../src/db/reader';
import { ChatStore } from '../../src/chat-store';
import { CursorModel } from '../../src/cursor/cursor-model';
import { FixtureCdp, FIXTURE_MLC_COMPOSER } from '../../src/cdp/fixture-cdp';
import { createTestDb, removeTestDb } from '../fixture';
import { seedRegisterBubble } from '../fixtures/agent-token-db';

const TOKEN = 'cr-agent-eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

describe('CursorSession', () => {
  let dbPath: string;
  let reader: CursorDbReader;
  let store: ChatStore;
  let model: CursorModel;

  beforeEach(async () => {
    dbPath = createTestDb();
    const db = new Database(dbPath);
    seedRegisterBubble(db, FIXTURE_MLC_COMPOSER, TOKEN);
    db.close();
    reader = CursorDbReader.fromPath(dbPath);
    store = new ChatStore(reader, dbPath, true);
    await store.refresh();
    model = new CursorModel(store, new FixtureCdp('idle'));
  });

  afterEach(() => {
    reader.close();
    removeTestDb(dbPath);
  });

  it('sessionByToken resolves composer and queue', async () => {
    await model.enqueueSend('hello', { token: TOKEN });
    const s = await model.sessionByToken(TOKEN);
    expect(s.composerId).toBe(FIXTURE_MLC_COMPOSER);
    expect(s.token).toBe(TOKEN);
    expect(s.windowTitle).toMatch(/mlc/);
    expect(s.queueLength).toBe(1);
    expect(s.agent.composerId).toBe(FIXTURE_MLC_COMPOSER);
    expect(s.modal).toBe('none');
  });

  it('session for composer', async () => {
    const s = await model.session(FIXTURE_MLC_COMPOSER);
    expect(s.composerId).toBe(FIXTURE_MLC_COMPOSER);
    expect(s.queueLength).toBe(0);
  });
});
