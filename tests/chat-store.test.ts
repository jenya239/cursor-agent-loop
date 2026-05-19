import { ChatStore } from '../src/chat-store';
import { CursorDbReader } from '../src/db/reader';
import { createTestDb, removeTestDb, COMPOSER_ID } from './fixture';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ChatStore', () => {
  const prevCache = process.env.CR_CACHE_DIR;

  beforeEach(() => {
    process.env.CR_CACHE_DIR = path.join(os.tmpdir(), `cr-cache-test-${process.pid}`);
  });

  afterEach(() => {
    if (prevCache === undefined) delete process.env.CR_CACHE_DIR;
    else process.env.CR_CACHE_DIR = prevCache;
    try {
      fs.rmSync(process.env.CR_CACHE_DIR!, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('refresh fills cache and writes disk', async () => {
    const dbPath = createTestDb();
    const reader = CursorDbReader.fromPath(dbPath);
    const store = new ChatStore(reader, dbPath, true);
    await store.refresh();
    expect(store.status().count).toBeGreaterThan(0);
    expect(store.getChats().chats.find((c) => c.composerId === COMPOSER_ID)).toBeTruthy();
    reader.close();
    removeTestDb(dbPath);
  });

  it('fast mode uses headers only', async () => {
    const dbPath = createTestDb();
    const reader = CursorDbReader.fromPath(dbPath);
    const store = new ChatStore(reader, dbPath, false);
    await store.refresh();
    expect(store.status().count).toBeGreaterThan(0);
    reader.close();
    removeTestDb(dbPath);
  });
});
