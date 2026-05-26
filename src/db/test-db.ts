import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const COMPOSER_ID = '11111111-1111-1111-1111-111111111111';
export const COMPOSER_ID_2 = '22222222-2222-2222-2222-222222222222';
export const BUSY_COMPOSER_ID = '33333333-3333-3333-3333-333333333333';

export function createTestDb(): string {
  const p = path.join(os.tmpdir(), `cr-test-${process.pid}-${Date.now()}.vscdb`);
  const db = new Database(p);

  db.exec(`
    CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB);
    CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value BLOB);
  `);

  const insertKv = db.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)');
  const insertItem = db.prepare('INSERT INTO ItemTable (key, value) VALUES (?, ?)');

  const composerData = {
    composerId: COMPOSER_ID,
    name: 'Test agent chat',
    unifiedMode: 'agent',
    createdAt: 1000,
    lastUpdatedAt: 3000,
    fullConversationHeadersOnly: [
      { bubbleId: 'b1', type: 1 },
      { bubbleId: 'b2', type: 2 },
    ],
    conversationMap: {},
  };

  insertKv.run(`composerData:${COMPOSER_ID}`, JSON.stringify(composerData));
  insertKv.run(
    `bubbleId:${COMPOSER_ID}:b1`,
    JSON.stringify({ text: 'Hello', type: 1, createdAt: 1001 })
  );
  insertKv.run(
    `bubbleId:${COMPOSER_ID}:b2`,
    JSON.stringify({ text: 'Hi there', type: 2, createdAt: 1002 })
  );

  const busyComposer = {
    composerId: BUSY_COMPOSER_ID,
    name: 'Busy chat',
    status: 'generating',
    generatingBubbleIds: ['b1'],
    fullConversationHeadersOnly: [{ bubbleId: 'b1', type: 1 }],
    conversationMap: {},
  };
  insertKv.run(`composerData:${busyComposer.composerId}`, JSON.stringify(busyComposer));
  insertKv.run(
    `bubbleId:${busyComposer.composerId}:b1`,
    JSON.stringify({ text: 'Wait', type: 1, createdAt: 3001 })
  );

  const legacyData = {
    composerId: COMPOSER_ID_2,
    name: 'Legacy map chat',
    fullConversationHeadersOnly: [{ bubbleId: 'lb1', type: 1 }],
    conversationMap: {
      lb1: { text: 'From map', type: 1, createdAt: 2000 },
    },
  };
  insertKv.run(`composerData:${COMPOSER_ID_2}`, JSON.stringify(legacyData));

  insertItem.run(
    'composer.composerHeaders',
    JSON.stringify({
      allComposers: [
        {
          composerId: COMPOSER_ID,
          name: 'Header index chat',
          lastUpdatedAt: 5000,
          unifiedMode: 'chat',
        },
      ],
    })
  );

  db.close();
  return p;
}

export function removeTestDb(p: string): void {
  try {
    fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}
