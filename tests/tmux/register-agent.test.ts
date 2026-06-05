import fs from 'fs';
import os from 'os';
import path from 'path';
import { getAgentStateByToken } from '../../src/db/agent-states';
import { migrate } from '../../src/db/migrate';
import { registerAgent } from '../../src/tmux';

function tempDatabasePath(): string {
  return path.join(os.tmpdir(), `cr-tmux-agent-test-${process.pid}-${Date.now()}.db`);
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

describe('registerAgent', () => {
  const previousPath = process.env.CR_DATABASE_PATH;

  afterEach(() => {
    if (previousPath === undefined) delete process.env.CR_DATABASE_PATH;
    else process.env.CR_DATABASE_PATH = previousPath;
  });

  it('upserts agent_states with pane as composer_id', () => {
    const databasePath = tempDatabasePath();
    process.env.CR_DATABASE_PATH = databasePath;
    try {
      migrate(databasePath);
      const row = registerAgent('%0', 'Driver', 'cr-agent-tmux', { databasePath });
      expect(row.token).toBe('cr-agent-tmux');
      expect(row.composer_id).toBe('%0');
      expect(row.role).toBe('Driver');
      const loaded = getAgentStateByToken('cr-agent-tmux', databasePath);
      expect(loaded?.composer_id).toBe('%0');
    } finally {
      removeDatabase(databasePath);
    }
  });

  it('updates existing token on re-register', () => {
    const databasePath = tempDatabasePath();
    process.env.CR_DATABASE_PATH = databasePath;
    try {
      migrate(databasePath);
      registerAgent('%0', 'Driver', 'cr-agent-tmux', { databasePath });
      const row = registerAgent('%1', 'Planner', 'cr-agent-tmux', { databasePath });
      expect(row.composer_id).toBe('%1');
      expect(row.role).toBe('Planner');
    } finally {
      removeDatabase(databasePath);
    }
  });
});
