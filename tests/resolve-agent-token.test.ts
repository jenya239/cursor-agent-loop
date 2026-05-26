import Database from 'better-sqlite3';
import { resolveAgentToken } from '../src/cursor/resolve-agent-token';
import { CursorDbReader } from '../src/db/reader';
import { createTestDb, removeTestDb, COMPOSER_ID } from './fixture';
import { seedRegisterBubble } from './fixtures/agent-token-db';

const TOKEN = 'cr-agent-22222222-2222-2222-2222-222222222222';

describe('resolveAgentToken', () => {
  let dbPath: string;
  let reader: CursorDbReader;

  afterEach(() => {
    reader?.close();
    if (dbPath) removeTestDb(dbPath);
  });

  it('returns summary when token in chat', () => {
    dbPath = createTestDb();
    const db = new Database(dbPath);
    seedRegisterBubble(db, COMPOSER_ID, TOKEN);
    db.close();
    reader = CursorDbReader.fromPath(dbPath);
    const r = resolveAgentToken(reader, TOKEN);
    expect(r?.composerId).toBe(COMPOSER_ID);
    expect(r?.token).toBe(TOKEN);
    expect(r?.name).toBeTruthy();
  });

  it('null when not in db yet', () => {
    dbPath = createTestDb();
    reader = CursorDbReader.fromPath(dbPath);
    expect(resolveAgentToken(reader, TOKEN)).toBeNull();
  });
});
