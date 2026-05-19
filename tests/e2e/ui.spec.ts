import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'http';
import { CursorDbReader } from '../../src/db/reader';
import { ChatStore } from '../../src/chat-store';
import { createApp } from '../../src/server';
import { CursorMock } from '../../src/cdp/cursor-mock';
import { createTestDb, removeTestDb, COMPOSER_ID } from '../fixture';

let server: Server;
let dbPath: string;
let reader: CursorDbReader;
let base: string;

test.beforeAll(async () => {
  dbPath = createTestDb();
  reader = CursorDbReader.fromPath(dbPath);
  const store = new ChatStore(reader, dbPath, true);
  await store.refresh();
  const app = createApp(store, { cdp: CursorMock.port('switch-ok') });
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 3847;
  base = `http://127.0.0.1:${port}`;
});

test.afterAll(() => {
  server?.close();
  reader?.close();
  if (dbPath) removeTestDb(dbPath);
});

test('list, open chat, agent panel', async ({ page }) => {
  await page.goto(base);
  await expect(page.locator('#list .item').first()).toBeVisible({ timeout: 10000 });
  const item = page.locator(`#list .item[data-id="${COMPOSER_ID}"]`);
  await expect(item).toBeVisible();
  await item.click();
  const panel = page.locator('#agent-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('агент');
});
