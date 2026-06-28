import fs from 'fs';
import os from 'os';
import path from 'path';
import { planGuardNudge, isExpectedSendBlock } from '../../src/cursor/guard-nudge';

describe('guard-nudge', () => {
  const orchPath = path.join(os.tmpdir(), `guard-nudge-${Date.now()}.json`);
  const agentDir = path.join(os.tmpdir(), `agent-gn-${Date.now()}`);

  beforeEach(() => {
    process.env.CR_ORCH_STATE = orchPath;
    fs.writeFileSync(orchPath, JSON.stringify({ byComposer: {} }));
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentDir, 'CONTINUITY.md'),
      '**INSTRUCTIONS_REV:** `2026-05-28-cleaner`\n'
    );
    fs.writeFileSync(
      path.join(agentDir, 'TRACK_TEST.md'),
      '## Status: **active**\n| 1 | a | pending |\n**STEP=1**\n'
    );
    fs.writeFileSync(path.join(agentDir, 'SESSION.md'), '| driver_turns_since_plan | 1 |\n');
  });

  afterEach(() => {
    delete process.env.CR_ORCH_STATE;
    fs.rmSync(agentDir, { recursive: true, force: true });
    try {
      fs.unlinkSync(orchPath);
    } catch {
      /* ok */
    }
  });

  it('skips when user turn pending', () => {
    const p = planGuardNudge({
      composerId: 'c1',
      agentDir,
      messages: [{ role: 'user', text: 'ROLE=Driver\nSTEP=1\n@docs/agent/TRACK_TEST.md\nx' }],
      token: 'cr-agent-t',
      targetId: 'mlc',
    });
    expect(p.action).toBe('skip');
  });

  it('recovery when stuck after assistant', () => {
    const p = planGuardNudge({
      composerId: 'c1',
      agentDir,
      messages: [
        { role: 'user', text: 'ROLE=Driver\nSTEP=1\n@docs/agent/TRACK_TEST.md\nx' },
        { role: 'assistant', text: 'worked but no enqueue' },
      ],
      token: 'cr-agent-t',
      targetId: 'mlc',
    });
    expect(p.action).toBe('recovery');
    if (p.action === 'recovery') {
      expect(p.role).toBe('Driver');
      expect(p.step).toBe('recovery');
    }
  });

  it('recovery when Driver:1 repeated 2x in chat (loop)', () => {
    const msg = { role: 'user' as const, text: 'ROLE=Driver\nSTEP=1\n@docs/agent/TRACK_TEST.md\nx' };
    const p = planGuardNudge({
      composerId: 'c1',
      agentDir,
      messages: [
        msg,
        { role: 'assistant', text: 'done partial' },
        msg,
        { role: 'assistant', text: 'still not committed' },
      ],
      token: 'cr-agent-t',
      targetId: 'mlc',
    });
    expect(p.action).toBe('recovery');
    if (p.action === 'recovery') expect(p.role).toBe('Driver');
  });

  it('isExpectedSendBlock', () => {
    expect(isExpectedSendBlock('send blocked: duplicate enqueue (Driver:3)')).toBe(true);
    expect(isExpectedSendBlock('switch failed: no-window')).toBe(false);
  });
});
