import fs from 'fs';
import os from 'os';
import path from 'path';
import { migrate } from '../../src/db/migrate';
import { listMeetingRows } from '../../src/db/meetings';
import { listMeetings, loadCachedMeetings, syncMeetingsFromDirectory } from '../../src/meetings/sync';

function tempDatabasePath(): string {
  return path.join(os.tmpdir(), `cr-meeting-sync-${process.pid}-${Date.now()}.db`);
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

describe('meetings sync', () => {
  const previousDatabasePath = process.env.CR_DATABASE_PATH;

  afterEach(() => {
    if (previousDatabasePath === undefined) delete process.env.CR_DATABASE_PATH;
    else process.env.CR_DATABASE_PATH = previousDatabasePath;
  });

  it('syncs meeting files into database', () => {
    const databasePath = tempDatabasePath();
    const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-meetings-'));
    const meetingsDirectory = path.join(repositoryRoot, 'docs', 'agent', 'meetings');
    fs.mkdirSync(meetingsDirectory, { recursive: true });
    process.env.CR_DATABASE_PATH = databasePath;
    try {
      migrate(databasePath);
      fs.writeFileSync(
        path.join(meetingsDirectory, '2026-06-05-orchestrator-planning.md'),
        '# Orchestrator planning\n'
      );
      const count = syncMeetingsFromDirectory(meetingsDirectory, { databasePath });
      expect(count).toBe(1);
      const rows = listMeetingRows({ databasePath, limit: 5 });
      expect(rows[0].slug).toBe('2026-06-05-orchestrator-planning');
      const cached = loadCachedMeetings(meetingsDirectory, { databasePath, limit: 5 });
      expect(cached[0].topic).toBe('orchestrator planning');
      const listed = listMeetings(meetingsDirectory, { databasePath, limit: 5 });
      expect(listed[0].path).toContain('2026-06-05-orchestrator-planning.md');
    } finally {
      removeDatabase(databasePath);
      fs.rmSync(repositoryRoot, { recursive: true, force: true });
    }
  });
});
