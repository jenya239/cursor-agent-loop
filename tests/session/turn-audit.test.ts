import fs from 'fs';
import os from 'os';
import path from 'path';
import { appendTurnAudit, turnLogPath } from '../../src/session/turn-audit';

describe('turn-audit', () => {
  const agentDir = path.join(os.tmpdir(), `turn-audit-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(agentDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(agentDir, { recursive: true, force: true });
  });

  it('appends jsonl lines', () => {
    appendTurnAudit(agentDir, {
      ts: '2026-06-24T12:00:00.000Z',
      event: 'sent',
      role: 'Driver',
      step: '7',
      why: 'guard nudge',
    });
    appendTurnAudit(agentDir, {
      ts: '2026-06-24T12:05:00.000Z',
      event: 'turn_done',
      prompt_key: 'Driver:7:CPP_PARSER_FULL',
      db_status: 'completed',
    });

    const lines = fs.readFileSync(turnLogPath(agentDir), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).event).toBe('sent');
    expect(JSON.parse(lines[1]).prompt_key).toBe('Driver:7:CPP_PARSER_FULL');
  });
});
