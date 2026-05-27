import { FixtureCdp } from '../../src/cdp/fixture-cdp';
import { createTestDb, removeTestDb } from '../fixture';
import { startWatchdogService } from '../../src/watchdog/service';

describe('startWatchdogService', () => {
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

  it('starts in-process poll loop', async () => {
    const svc = await startWatchdogService({ cdp: new FixtureCdp('idle'), pollMs: 60_000 });
    await svc.daemon.tick();
    expect(svc.stats.snapshot().polls_total).toBe(1);
    svc.close();
  }, 30_000);
});
