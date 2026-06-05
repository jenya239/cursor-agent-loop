import fs from 'fs';
import os from 'os';
import path from 'path';
import { listCostEntries, recordCostEntry } from '../../src/db/cost-entries';
import { migrate } from '../../src/db/migrate';

function tempDatabasePath(): string {
  return path.join(os.tmpdir(), `cr-cost-test-${process.pid}-${Date.now()}.db`);
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

describe('cost-entries', () => {
  it('records and lists enqueue cost rows', () => {
    const databasePath = tempDatabasePath();
    try {
      migrate(databasePath);
      const row = recordCostEntry({
        databasePath,
        agentToken: 'cr-agent-test',
        composerId: '11111111-1111-1111-1111-111111111111',
        contextPercent: 42.5,
        model: 'Sonnet',
        eventType: 'enqueue',
      });
      expect(row.event_type).toBe('enqueue');
      expect(row.context_percent).toBe(42.5);
      const entries = listCostEntries({ databasePath, limit: 10 });
      expect(entries).toHaveLength(1);
      expect(entries[0].model).toBe('Sonnet');
    } finally {
      removeDatabase(databasePath);
    }
  });
});
