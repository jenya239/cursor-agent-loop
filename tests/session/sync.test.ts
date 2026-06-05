import fs from 'fs';
import os from 'os';
import path from 'path';
import { migrate } from '../../src/db/migrate';
import { listWorkspaceTurns } from '../../src/db/turns';
import { loadCachedSessionTurns, syncSessionTurnsFromAgentDir } from '../../src/session/sync';

function tempDatabasePath(): string {
  return path.join(os.tmpdir(), `cr-sync-test-${process.pid}-${Date.now()}.db`);
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

describe('session sync', () => {
  const previousDatabasePath = process.env.CR_DATABASE_PATH;

  afterEach(() => {
    if (previousDatabasePath === undefined) delete process.env.CR_DATABASE_PATH;
    else process.env.CR_DATABASE_PATH = previousDatabasePath;
  });

  it('syncs SESSION.md into turns table', () => {
    const databasePath = tempDatabasePath();
    const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-repo-'));
    const agentDir = path.join(repositoryRoot, 'docs', 'agent');
    fs.mkdirSync(agentDir, { recursive: true });
    process.env.CR_DATABASE_PATH = databasePath;
    try {
      migrate(databasePath);
      fs.writeFileSync(
        path.join(agentDir, 'SESSION.md'),
        `### Turn 2026-06-05 (Driver TRACK_ORCH_DEV step 5)

| field | value |
|-------|-------|
| role | Driver |
| step | 5 |
| done | session cache |
| result | tests ok |
`
      );
      const count = syncSessionTurnsFromAgentDir(agentDir, { databasePath });
      expect(count).toBe(1);
      const rows = listWorkspaceTurns({ workspace: 'cr', databasePath, limit: 5 });
      expect(rows[0].done).toBe('session cache');
      const cached = loadCachedSessionTurns(agentDir, { databasePath, limit: 5 });
      expect(cached[0].step).toBe('5');
    } finally {
      removeDatabase(databasePath);
      fs.rmSync(repositoryRoot, { recursive: true, force: true });
    }
  });
});
