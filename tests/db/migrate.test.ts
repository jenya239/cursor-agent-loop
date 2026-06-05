import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { defaultCrDatabasePath } from '../../src/db/cr-paths';
import { migrate, openCrDatabase } from '../../src/db/migrate';

function tempDatabasePath(): string {
  return path.join(os.tmpdir(), `cr-migrate-test-${process.pid}-${Date.now()}.db`);
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

describe('migrate', () => {
  it('defaultCrDatabasePath points at repo db/cr.db', () => {
    expect(defaultCrDatabasePath()).toMatch(/[/\\]db[/\\]cr\.db$/);
  });

  it('applies 001_initial and is idempotent', () => {
    const databasePath = tempDatabasePath();
    try {
      const first = migrate(databasePath);
      expect(first.applied).toEqual([1]);

      const second = migrate(databasePath);
      expect(second.applied).toEqual([]);

      const database = new Database(databasePath, { readonly: true });
      const tables = database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        .all()
        .map((row) => (row as { name: string }).name);
      database.close();

      expect(tables).toEqual([
        'agent_states',
        'cost_entries',
        'meetings',
        'schema_migrations',
        'turns',
      ]);
    } finally {
      removeDatabase(databasePath);
    }
  });

  it('openCrDatabase returns writable connection', () => {
    const databasePath = tempDatabasePath();
    try {
      const database = openCrDatabase(databasePath);
      database
        .prepare(
          'INSERT INTO turns (workspace, role, step) VALUES (?, ?, ?)'
        )
        .run('mlc', 'Driver', '4');
      const count = database
        .prepare('SELECT COUNT(*) AS count FROM turns')
        .get() as { count: number };
      database.close();
      expect(count.count).toBe(1);
    } finally {
      removeDatabase(databasePath);
    }
  });
});
