import { CursorDbReader } from '../src/db/reader';
import { ChatStore } from '../src/chat-store';
import { CursorModel } from '../src/cursor/cursor-model';
import { findWindowForComposerId } from '../src/cdp/active-composer';
import {
  FixtureCdp,
  FIXTURE_ACTIVE_COMPOSER,
  FIXTURE_MLC_COMPOSER,
  FIXTURE_NORD_COMPOSER,
} from '../src/cdp/fixture-cdp';
import { composerIdsMatch, isAgentsWindowTitle } from '../src/cdp/window-match';
import { createTestDb, removeTestDb } from './fixture';
import Database from 'better-sqlite3';
import { seedRegisterBubble } from './fixtures/agent-token-db';

const ENQ_TOKEN = 'cr-agent-dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('switch routing (fixture)', () => {
  it('composerIdsMatch partial uuid', () => {
    expect(composerIdsMatch('f8e0a645-1610-4a1e-b19f-63f502235a2e', 'f8e0a645-xxxx')).toBe(true);
    expect(composerIdsMatch(FIXTURE_NORD_COMPOSER, FIXTURE_MLC_COMPOSER)).toBe(false);
  });

  it('isAgentsWindowTitle', () => {
    expect(isAgentsWindowTitle('Cursor Agents')).toBe(true);
    expect(isAgentsWindowTitle('Cursor Settings - mlc - Cursor')).toBe(false);
  });

  it('workspace-window-not-found', async () => {
    const cdp = new FixtureCdp('idle');
    const r = await cdp.switchComposer(FIXTURE_MLC_COMPOSER, {
      workspaceHints: ['no-such-workspace'],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('workspace-window-not-found');
  });

  it('verified switch to cr', async () => {
    const cdp = new FixtureCdp('idle');
    const r = await cdp.switchComposer(FIXTURE_ACTIVE_COMPOSER, { workspaceHints: ['cr'] });
    expect(r.ok).toBe(true);
    expect(r.switchTarget).toMatch(/cr - cr/);
  });

  it('findWindowForComposerId when bar matches', async () => {
    const cdp = new FixtureCdp('idle');
    const w = await findWindowForComposerId(cdp, FIXTURE_MLC_COMPOSER, ['mlc']);
    expect(w?.windowTitle).toMatch(/mlc/);
    expect(w?.composerId).toBe(FIXTURE_MLC_COMPOSER);
  });

  it('verified switch to mlc window', async () => {
    const cdp = new FixtureCdp('idle');
    const r = await cdp.switchComposer(FIXTURE_MLC_COMPOSER, { workspaceHints: ['mlc'] });
    expect(r.ok).toBe(true);
    expect(r.switchTarget).toMatch(/mlc/);
  });

  it('switch-mismatch when mlc id but only cr window', async () => {
    const cdp = new FixtureCdp('idle');
    const r = await cdp.switchComposer(FIXTURE_MLC_COMPOSER, { workspaceHints: ['cr'] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('switch-mismatch');
  });

  it('send uses windowTitle not default cr', async () => {
    const cdp = new FixtureCdp('idle');
    const r = await cdp.sendMessage('hi', { windowTitle: 'nord' });
    expect(r.pageTitle).toMatch(/nord/);
  });

  it('enqueue always server queue; drain sends when idle', async () => {
    const dbPath = createTestDb();
    const db = new Database(dbPath);
    seedRegisterBubble(db, FIXTURE_MLC_COMPOSER, ENQ_TOKEN);
    db.close();
    const reader = CursorDbReader.fromPath(dbPath);
    const store = new ChatStore(reader, dbPath, true);
    await store.refresh();
    const m = new CursorModel(store, new FixtureCdp('idle'));
    const r = await m.enqueueSend('x', { token: ENQ_TOKEN });
    expect(r.deferred).toBe(true);
    expect(m.listSendQueue()).toHaveLength(1);
    const d = await m.drainSendQueue();
    expect(d.sent).toBe(1);
    expect(m.listSendQueue()).toHaveLength(0);
    reader.close();
    removeTestDb(dbPath);
  });
});

describe('active composer (fixture)', () => {
  it('returns cr composer from first composered window', () => {
    const cdp = new FixtureCdp('idle');
    const a = cdp.getActiveComposer();
    expect(a?.composerId).toBe(FIXTURE_ACTIVE_COMPOSER);
    expect(a?.windowTitle).toMatch(/cr - cr/);
  });
});
