import fs from 'fs';
import os from 'os';
import path from 'path';
import { migrate } from '../../src/db/migrate';
import { listMeetingRows, replaceMeetings } from '../../src/db/meetings';

function tempDatabasePath(): string {
  return path.join(os.tmpdir(), `cr-meetings-test-${process.pid}-${Date.now()}.db`);
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

describe('meetings db', () => {
  const previousDatabasePath = process.env.CR_DATABASE_PATH;

  afterEach(() => {
    if (previousDatabasePath === undefined) delete process.env.CR_DATABASE_PATH;
    else process.env.CR_DATABASE_PATH = previousDatabasePath;
  });

  it('replaces meetings in database', () => {
    const databasePath = tempDatabasePath();
    process.env.CR_DATABASE_PATH = databasePath;
    try {
      migrate(databasePath);
      const count = replaceMeetings(
        [
          {
            slug: '2026-06-05-agent-roles',
            topic: 'agent roles',
            path: '/tmp/meeting.md',
            startedAt: '2026-06-05',
            endedAt: null,
          },
        ],
        databasePath
      );
      expect(count).toBe(1);
      const rows = listMeetingRows({ databasePath, limit: 5 });
      expect(rows[0].topic).toBe('agent roles');
    } finally {
      removeDatabase(databasePath);
    }
  });
});
