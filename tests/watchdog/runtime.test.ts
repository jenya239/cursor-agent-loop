import { FixtureCdp } from '../../src/cdp/fixture-cdp';
import { CursorDbReader } from '../../src/db/reader';
import { createTestDb, removeTestDb } from '../fixture';
import { createWatchdogRuntime } from '../../src/watchdog/runtime';

describe('createWatchdogRuntime', () => {
  let dbPath: string;
  let prevDb: string | undefined;

  beforeEach(() => {
    dbPath = createTestDb();
    prevDb = process.env.CURSOR_DB;
    process.env.CURSOR_DB = dbPath;
  });

  afterEach(() => {
    if (prevDb === undefined) delete process.env.CURSOR_DB;
    else process.env.CURSOR_DB = prevDb;
    removeTestDb(dbPath);
  });

  it('creates cursor with fixture cdp', async () => {
    const rt = await createWatchdogRuntime({ cdp: new FixtureCdp('idle') });
    expect(await rt.cdp.status()).toEqual({ ok: true, url: 'fixture://cdp' });
    const s = await rt.cursor.session('00000000-0000-0000-0000-000000000001');
    expect(s.composerId).toBe('00000000-0000-0000-0000-000000000001');
    rt.close();
  });
});
