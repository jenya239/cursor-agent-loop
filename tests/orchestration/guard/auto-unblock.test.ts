import fs from 'fs';
import os from 'os';
import path from 'path';
import { planGuardNudge } from '../../../src/cursor/guard-nudge';
import { pickNextAgentStep, pickDriverStep } from '../../../src/cursor/agent_next';

describe('guard auto-unblock', () => {
  const orchPath = path.join(os.tmpdir(), `guard-unblock-${process.pid}.json`);
  const agentDir = path.join(os.tmpdir(), `agent-unblock-${process.pid}`);

  beforeEach(() => {
    process.env.CR_ORCH_STATE = orchPath;
    fs.writeFileSync(orchPath, JSON.stringify({ byComposer: {} }));
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentDir, 'CONTINUITY.md'),
      '**INSTRUCTIONS_REV:** `2026-05-28-cleaner`\n'
    );
    fs.writeFileSync(
      path.join(agentDir, 'SESSION.md'),
      '| driver_turns_since_plan | 0 |\n| role_last | recovery |\n'
    );
  });

  afterEach(() => {
    delete process.env.CR_ORCH_STATE;
    fs.rmSync(agentDir, { recursive: true, force: true });
    try {
      fs.unlinkSync(orchPath);
    } catch { /* ok */ }
  });

  it('pickDriverStep finds step from gate-pending partial status', () => {
    fs.writeFileSync(
      path.join(agentDir, 'TRACK_BOOTSTRAP_LINK.md'),
      [
        '## Status: **open** STEP=6-gate',
        '| 6 | bootstrap gate | done (partial — bootstrap gate pending) |',
        '**STEP=6**',
      ].join('\n')
    );
    const driver = pickDriverStep(agentDir);
    expect(driver?.role).toBe('Driver');
    expect(driver?.step).toBe('6');
  });

  it('sends Driver when Planner plan-refresh deduped', () => {
    fs.writeFileSync(
      path.join(agentDir, 'TRACK_BOOTSTRAP_LINK.md'),
      '## Status: **open**\n| 6 | gate | pending |\n**STEP=6**\n'
    );
    const planMsg = {
      role: 'user' as const,
      text: 'ROLE=Planner\nSTEP=plan-refresh\n@docs/agent/TRACK_PLAN.md\nrefresh',
    };
    const p = planGuardNudge({
      composerId: 'c1',
      agentDir,
      messages: [
        planMsg,
        { role: 'assistant', text: 'planned' },
        planMsg,
        { role: 'assistant', text: 'planned again' },
      ],
      token: 'cr-agent-t',
      targetId: 'mlc',
    });
    expect(p.action).toBe('send');
    if (p.action === 'send') {
      expect(p.role).toBe('Driver');
      expect(p.step).toBe('6');
    }
  });

  it('pickNext prefers Driver over idle Planner when pending exists', () => {
    fs.writeFileSync(
      path.join(agentDir, 'TRACK_BOOTSTRAP_LINK.md'),
      '## Status: **open**\n| 6 | gate | pending |\n**STEP=6**\n'
    );
    const next = pickNextAgentStep(agentDir);
    expect(next.role).toBe('Driver');
    expect(next.step).toBe('6');
  });
});
