import { CursorMock } from '../src/cdp/cursor-mock';
import { resolveSendTarget } from '../src/cursor/resolve-target';
import { CursorDbReader } from '../src/db/reader';
import Database from 'better-sqlite3';
import { createTestDb, removeTestDb, COMPOSER_ID } from './fixture';
import { seedRegisterBubble } from './fixtures/agent-token-db';

const TOKEN = 'cr-agent-33333333-3333-3333-3333-333333333333';

describe('resolveSendTarget', () => {
  let dbPath: string;
  let reader: CursorDbReader;

  afterEach(() => {
    reader?.close();
    if (dbPath) removeTestDb(dbPath);
  });

  it('requires token', async () => {
    dbPath = createTestDb();
    reader = CursorDbReader.fromPath(dbPath);
    await expect(
      resolveSendTarget(CursorMock.port('idle'), { token: '', db: reader })
    ).rejects.toThrow(/token/);
  });

  it('resolves composerId from token in db', async () => {
    dbPath = createTestDb();
    const db = new Database(dbPath);
    seedRegisterBubble(db, COMPOSER_ID, TOKEN);
    db.close();
    reader = CursorDbReader.fromPath(dbPath);
    const r = await resolveSendTarget(CursorMock.port('idle'), { token: TOKEN, db: reader });
    expect(r.composerId).toBe(COMPOSER_ID);
    expect(r.resolved).toBe('token');
  });

  it('throws when token not found', async () => {
    dbPath = createTestDb();
    reader = CursorDbReader.fromPath(dbPath);
    await expect(
      resolveSendTarget(CursorMock.port('idle'), { token: TOKEN, db: reader })
    ).rejects.toThrow(/not found|register/i);
  });

  it('uses server bind when token not in db yet', async () => {
    const { bindAgentToken, clearAllTokenBinds } = await import('../src/cursor/token-bind');
    clearAllTokenBinds();
    bindAgentToken(TOKEN, COMPOSER_ID);
    dbPath = createTestDb();
    reader = CursorDbReader.fromPath(dbPath);
    const r = await resolveSendTarget(CursorMock.port('idle'), { token: TOKEN, db: reader });
    expect(r.composerId).toBe(COMPOSER_ID);
    expect(r.resolved).toBe('bind');
    clearAllTokenBinds();
  });
});
