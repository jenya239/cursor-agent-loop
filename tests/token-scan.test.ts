import type { BubblePayload } from '../src/db/types';
import { bubbleContainsToken, findComposerByToken } from '../src/db/token-scan';
import { CursorDbReader } from '../src/db/reader';
import { createTestDb, removeTestDb, COMPOSER_ID, COMPOSER_ID_2 } from './fixture';
import Database from 'better-sqlite3';
import { seedRegisterBubble } from './fixtures/agent-token-db';

const TOKEN = 'cr-agent-11111111-1111-1111-1111-111111111111';

describe('bubbleContainsToken', () => {
  it('matches cursor_agent_register toolFormerData.result', () => {
    const b: BubblePayload = {
      toolFormerData: {
        name: 'cursor_agent_register',
        status: 'completed',
        result: JSON.stringify({ token: TOKEN, kind: 'cr-agent-token', v: 1 }),
      },
    };
    expect(bubbleContainsToken(b, TOKEN)).toBe(true);
  });

  it('ignores plain text / AGENT_TOKEN= mention', () => {
    expect(bubbleContainsToken({ text: `AGENT_TOKEN=${TOKEN}` }, TOKEN)).toBe(false);
    expect(bubbleContainsToken({ text: `token: ${TOKEN}` }, TOKEN)).toBe(false);
  });

  it('ignores other tools mentioning token in result', () => {
    expect(
      bubbleContainsToken(
        {
          toolFormerData: {
            name: 'cursor_send',
            result: JSON.stringify({ token: TOKEN }),
          },
        },
        TOKEN
      )
    ).toBe(false);
  });

  it('false without register bubble', () => {
    expect(bubbleContainsToken({ text: 'hello' }, TOKEN)).toBe(false);
  });
});

describe('findComposerByToken', () => {
  let dbPath: string;
  let reader: CursorDbReader;

  afterEach(() => {
    reader?.close();
    if (dbPath) removeTestDb(dbPath);
  });

  it('finds composer with register bubble', () => {
    dbPath = createTestDb();
    const db = new Database(dbPath);
    seedRegisterBubble(db, COMPOSER_ID, TOKEN);
    db.close();
    reader = CursorDbReader.fromPath(dbPath);
    const r = findComposerByToken(reader, TOKEN);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.composerId).toBe(COMPOSER_ID);
  });

  it('not_found when token only quoted in text', () => {
    dbPath = createTestDb();
    const db = new Database(dbPath);
    const insertKv = db.prepare(
      'INSERT OR REPLACE INTO cursorDiskKV (key, value) VALUES (?, ?)'
    );
    insertKv.run(
      `composerData:${COMPOSER_ID}`,
      JSON.stringify({
        composerId: COMPOSER_ID,
        fullConversationHeadersOnly: [{ bubbleId: 'b1', type: 1 }],
        conversationMap: {
          b1: { text: `AGENT_TOKEN=${TOKEN}\ncontinue` },
        },
      })
    );
    db.close();
    reader = CursorDbReader.fromPath(dbPath);
    const r = findComposerByToken(reader, TOKEN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('not_found when token absent', () => {
    dbPath = createTestDb();
    reader = CursorDbReader.fromPath(dbPath);
    const r = findComposerByToken(reader, TOKEN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('ambiguous when two chats have register with same token', () => {
    dbPath = createTestDb();
    const db = new Database(dbPath);
    seedRegisterBubble(db, COMPOSER_ID, TOKEN);
    seedRegisterBubble(db, COMPOSER_ID_2, TOKEN);
    db.close();
    reader = CursorDbReader.fromPath(dbPath);
    const r = findComposerByToken(reader, TOKEN);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('ambiguous');
      expect(r.composerIds?.length).toBe(2);
    }
  });
});
