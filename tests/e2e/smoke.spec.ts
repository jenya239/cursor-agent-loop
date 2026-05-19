import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'http';
import { CursorDbReader } from '../../src/db/reader';
import { ChatStore } from '../../src/chat-store';
import { createApp } from '../../src/server';
import { CursorMock } from '../../src/cdp/cursor-mock';
import { createTestDb, removeTestDb } from '../fixture';

let server: Server;
let dbPath: string;
let reader: CursorDbReader;

test.beforeAll(async () => {
  dbPath = createTestDb();
  reader = CursorDbReader.fromPath(dbPath);
  const store = new ChatStore(reader, dbPath, true);
  await store.refresh();
  const app = createApp(store, { cdp: CursorMock.port('idle') });
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
});

test.afterAll(() => {
  server?.close();
  reader?.close();
  if (dbPath) removeTestDb(dbPath);
});

test('health and snapshot', async () => {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 3847;
  const base = `http://127.0.0.1:${port}`;
  const health = await fetch(`${base}/api/health`);
  expect(health.ok).toBe(true);
  const snap = await (await fetch(`${base}/api/cursor/snapshot`)).json();
  expect(snap.cdp.ok).toBe(true);
  expect(snap.switch).toBeNull();
});
