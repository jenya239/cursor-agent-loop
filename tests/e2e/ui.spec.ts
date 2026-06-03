import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'http';
import { CursorDbReader } from '../../src/db/reader';
import { ChatStore } from '../../src/chat-store';
import { createApp } from '../../src/server';
import { CursorMock } from '../../src/cdp/cursor-mock';
import { WatchdogStats } from '../../src/watchdog/stats';
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
  const stats = new WatchdogStats(1_000_000);
  stats.recordObserve([
    {
      windowTitle: 'mlc - Cursor',
      composerId: 'abcd1234-0000',
      model: 'Fast',
      busy: true,
      slowCount: 1,
      draftLen: 0,
      draftHasToken: false,
    },
  ]);
  const app = createApp(store, { cdp: CursorMock.port('switch-ok'), watchdogStats: stats });
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

test('watchdog tab shows stats table', async ({ page }) => {
  await page.goto(base);
  await expect(page.locator('#tab-watchdog')).toBeVisible();
  await page.locator('#tab-watchdog').click();
  await expect(page.locator('#layout')).toBeHidden();
  await expect(page.locator('#watchdog-panel')).toBeVisible();
  await expect(page.locator('#watchdog-body')).toContainText('mlc - Cursor');
  await expect(page.locator('#watchdog-body')).toContainText('busy');
  await page.locator('#tab-chats').click();
  await expect(page.locator('#layout')).toBeVisible();
  await expect(page.locator('#watchdog-panel')).toBeHidden();
});

test('layout tab shows window tree', async ({ page }) => {
  await page.goto(base);
  await page.locator('#tab-layout').click();
  await expect(page.locator('#layout')).toBeHidden();
  await expect(page.locator('#cursor-layout-panel')).toBeVisible();
  await expect(page.locator('#cursor-layout-body')).toContainText('Cursor Agents');
  await expect(page.locator('#cursor-layout-body')).toContainText('agents-v3');
  await expect(page.locator('#cursor-layout-body')).toContainText('workbench-v2');
});
