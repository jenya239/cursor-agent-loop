import { bubbleText } from '../src/db/bubble-text';
import { CursorDbReader, listWorkspaceChats } from '../src/db/reader';
import { createTestDb, removeTestDb, COMPOSER_ID, COMPOSER_ID_2 } from './fixture';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

describe('CursorDbReader', () => {
  let dbPath: string;
  let reader: CursorDbReader;

  beforeEach(() => {
    dbPath = createTestDb();
    reader = CursorDbReader.fromPath(dbPath);
  });

  afterEach(() => {
    reader.close();
    removeTestDb(dbPath);
  });

  it('lists chats from headers and composerData keys', () => {
    const chats = reader.listChats();
    const ids = chats.map((c) => c.composerId);
    expect(ids).toContain(COMPOSER_ID);
    expect(ids).toContain(COMPOSER_ID_2);
    const fromHeader = chats.find((c) => c.composerId === COMPOSER_ID);
    expect(fromHeader?.name).toBe('Header index chat');
  });

  it('skips empty header-only composers', () => {
    const dbPath = createTestDb();
    const db = require('better-sqlite3')(dbPath);
    db.prepare('UPDATE ItemTable SET value = ? WHERE key = ?').run(
      JSON.stringify({
        allComposers: [
          { composerId: 'empty-0000-0000-0000-000000000001', unifiedMode: 'chat' },
          { composerId: COMPOSER_ID, name: 'Has messages', lastUpdatedAt: 5000 },
        ],
      }),
      'composer.composerHeaders'
    );
    db.close();
    const r2 = CursorDbReader.fromPath(dbPath);
    const list = r2.listFromGlobalHeaders();
    expect(list.some((c) => c.composerId === 'empty-0000-0000-0000-000000000001')).toBe(false);
    expect(list.some((c) => c.composerId === COMPOSER_ID)).toBe(true);
    r2.close();
    removeTestDb(dbPath);
  });

  it('reads v3 bubble messages in order', () => {
    process.env.MERGE_MESSAGES = '0';
    const msgs = reader.getMessages(COMPOSER_ID);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ role: 'user', text: 'Hello', bubbleId: 'b1' });
    expect(msgs[1]).toMatchObject({ role: 'assistant', text: 'Hi there', bubbleId: 'b2' });
  });

  it('reads legacy conversationMap', () => {
    process.env.MERGE_MESSAGES = '0';
    const msgs = reader.getMessages(COMPOSER_ID_2);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe('From map');
  });

  it('returns empty for unknown composer', () => {
    expect(reader.getMessages('00000000-0000-0000-0000-000000000000')).toEqual([]);
  });
});

describe('bubbleText', () => {
  it('returns text field', () => {
    expect(bubbleText({ text: 'x' })).toBe('x');
  });
  it('returns empty when missing', () => {
    expect(bubbleText({})).toBe('');
  });
});

describe('listWorkspaceChats', () => {
  it('reads allComposers from workspace db', () => {
    const p = path.join(os.tmpdir(), `cr-ws-${Date.now()}.vscdb`);
    const db = new Database(p);
    db.exec('CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)');
    db.prepare('INSERT INTO ItemTable (key, value) VALUES (?, ?)').run(
      'composer.composerData',
      JSON.stringify({
        allComposers: [
          { composerId: 'aaa', name: 'Ws chat', createdAt: 1 },
        ],
      })
    );
    db.close();

    const list = listWorkspaceChats(p);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Ws chat');
    fs.unlinkSync(p);
  });
});
