import Database from 'better-sqlite3';
import { ChatStore } from '../../src/chat-store';
import { CursorDbReader } from '../../src/db/reader';
import { COMPOSER_ID, createTestDb, removeTestDb } from '../../src/db/test-db';
import { CursorModel } from '../../src/cursor/cursor-model';
import { FixtureCdp } from '../../src/cdp/fixture-cdp';
import { bindAgentToken } from '../../src/cursor/token-bind';
import { ModelApi } from '../../src/ui/api/model-api';
import { seedRegisterBubble } from '../fixtures/agent-token-db';

const TOKEN = 'cr-agent-ui-model-000000000001';

describe('ModelApi', () => {
  let dbPath: string;
  let reader: CursorDbReader;
  let store: ChatStore;
  let api: ModelApi;

  beforeEach(async () => {
    dbPath = createTestDb();
    const db = new Database(dbPath);
    seedRegisterBubble(db, COMPOSER_ID, TOKEN);
    db.close();
    reader = CursorDbReader.fromPath(dbPath);
    store = new ChatStore(reader, dbPath, true);
    await store.refresh();
    bindAgentToken(TOKEN, COMPOSER_ID);
    const model = new CursorModel(store, new FixtureCdp('idle'));
    api = new ModelApi(model, store, { token: TOKEN, defaultComposerId: COMPOSER_ID });
  });

  afterEach(() => {
    reader.close();
    removeTestDb(dbPath);
  });

  it('snapshot and chat', async () => {
    const s = await api.snapshot(COMPOSER_ID);
    expect(s.agent.composerId).toBe(COMPOSER_ID);
    const c = await api.chat(COMPOSER_ID);
    expect(c.messages.length).toBeGreaterThan(0);
  });

  it('send via model', async () => {
    const r = await api.send('hello');
    expect(r.text).toBe('hello');
  });
});
