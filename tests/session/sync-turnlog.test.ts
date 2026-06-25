import fs from 'fs';
import os from 'os';
import path from 'path';
import { migrate } from '../../src/db/migrate';
import { listTurnAuditEvents } from '../../src/db/turn-audit';
import { syncTurnLogFromAgentDir } from '../../src/session/sync-turnlog';

function tempDatabasePath(): string {
  return path.join(os.tmpdir(), `cr-turn-audit-test-${process.pid}-${Date.now()}.db`);
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

describe('turn audit sync', () => {
  it('syncs TURNLOG.jsonl into turn_audit_events', () => {
    const databasePath = tempDatabasePath();
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-repo-'));
    const agentDir = path.join(repoRoot, 'docs', 'agent');
    fs.mkdirSync(agentDir, { recursive: true });
    try {
      migrate(databasePath);
      fs.writeFileSync(
        path.join(agentDir, 'TURNLOG.jsonl'),
        [
          '{"ts":"2026-06-24T12:00:00.000Z","event":"sent","role":"Driver","step":"1","why":"guard nudge"}',
          '{"ts":"2026-06-24T12:05:00.000Z","event":"turn_done","role":"Driver","step":"1","prompt_key":"Driver:1:TEST","db_status":"completed"}',
        ].join('\n') + '\n'
      );
      const added = syncTurnLogFromAgentDir(agentDir, { databasePath });
      expect(added).toBe(2);
      const again = syncTurnLogFromAgentDir(agentDir, { databasePath });
      expect(again).toBe(0);
      const rows = listTurnAuditEvents({ workspace: 'cr', databasePath, limit: 10 });
      expect(rows).toHaveLength(2);
      expect(rows.some((r) => r.event === 'turn_done')).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
      removeDatabase(databasePath);
    }
  });
});
