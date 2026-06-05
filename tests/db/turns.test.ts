import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  listSessionTurnsFromDatabase,
  replaceWorkspaceTurns,
} from '../../src/db/turns';
import { migrate } from '../../src/db/migrate';

function tempDatabasePath(): string {
  return path.join(os.tmpdir(), `cr-turns-test-${process.pid}-${Date.now()}.db`);
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

describe('turns cache', () => {
  it('replaces and lists workspace turns', () => {
    const databasePath = tempDatabasePath();
    try {
      migrate(databasePath);
      const count = replaceWorkspaceTurns(
        'mlc',
        [
          {
            workspace: 'mlc',
            track: 'TRACK_ORCH_DEV',
            role: 'Driver',
            step: '3',
            startedAt: '2026-06-05',
            done: 'tmux',
            result: 'build ok',
          },
        ],
        databasePath
      );
      expect(count).toBe(1);
      const turns = listSessionTurnsFromDatabase({
        workspace: 'mlc',
        databasePath,
        limit: 10,
      });
      expect(turns).toHaveLength(1);
      expect(turns[0].role).toBe('Driver');
      expect(turns[0].done).toBe('tmux');
      expect(turns[0].gate).toBe('build ok');
    } finally {
      removeDatabase(databasePath);
    }
  });
});
