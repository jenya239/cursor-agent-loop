import fs from 'fs';
import os from 'os';
import path from 'path';
import { CursorMock } from '../../src/cdp/cursor-mock';
import { recordEnqueueCost } from '../../src/billing/enqueue-cost';
import { listCostEntries } from '../../src/db/cost-entries';
import { migrate } from '../../src/db/migrate';

function tempDatabasePath(): string {
  return path.join(os.tmpdir(), `cr-billing-test-${process.pid}-${Date.now()}.db`);
}

function removeDatabase(databasePath: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(`${databasePath}${suffix}`);
    } catch {
      /* ignore */
    }
  }
}

describe('recordEnqueueCost', () => {
  const previousPath = process.env.CR_DATABASE_PATH;

  afterEach(() => {
    if (previousPath === undefined) delete process.env.CR_DATABASE_PATH;
    else process.env.CR_DATABASE_PATH = previousPath;
  });

  it('writes cost_entries without throwing when CDP is idle', async () => {
    const databasePath = tempDatabasePath();
    process.env.CR_DATABASE_PATH = databasePath;
    try {
      migrate(databasePath);
      await recordEnqueueCost(CursorMock.port('down'), {
        agentToken: 'cr-agent-bill',
        composerId: '11111111-1111-1111-1111-111111111111',
        databasePath,
      });
      const entries = listCostEntries({ databasePath });
      expect(entries).toHaveLength(1);
      expect(entries[0].agent_token).toBe('cr-agent-bill');
      expect(entries[0].event_type).toBe('enqueue');
    } finally {
      removeDatabase(databasePath);
    }
  });
});
