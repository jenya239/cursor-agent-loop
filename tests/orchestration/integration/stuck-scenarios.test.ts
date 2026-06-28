import fs from 'fs';
import os from 'os';
import path from 'path';
import { planGuardNudge } from '../../../src/orchestration/guard/plan-nudge';
import { pickNextFromState } from '../../../src/orchestration/pick/pick-next';
import { parseTrackContent } from '../../../src/orchestration/track/parse-content';
import type { TrackInfo } from '../../../src/orchestration/types';

function trackFromContent(name: string, body: string): TrackInfo {
  const p = parseTrackContent(name, body);
  return {
    file: `${name}.md`,
    name,
    closed: p.closed,
    inProgress: p.inProgress,
    pendingSteps: p.pendingSteps,
    focus: p.focus,
    hasBlockedSkip: p.hasBlockedSkip,
  };
}

describe('stuck scenarios matrix', () => {
  const orchPath = path.join(os.tmpdir(), `matrix-${process.pid}.json`);
  const agentDir = path.join(os.tmpdir(), `matrix-agent-${process.pid}`);

  beforeEach(() => {
    process.env.CR_ORCH_STATE = orchPath;
    fs.writeFileSync(orchPath, JSON.stringify({ byComposer: {} }));
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, 'CONTINUITY.md'), '**INSTRUCTIONS_REV:** `2026-05-28-cleaner`\n');
    fs.writeFileSync(path.join(agentDir, 'SESSION.md'), '| driver_turns_since_plan | 8 |\n| role_last | Driver |\n');
  });

  afterEach(() => {
    delete process.env.CR_ORCH_STATE;
    fs.rmSync(agentDir, { recursive: true, force: true });
    try { fs.unlinkSync(orchPath); } catch { /* ok */ }
  });

  const cases: Array<{ name: string; track: string; expectStep: string }> = [
    {
      name: 'gate-pending partial',
      track: '## Status: **open**\n| 6 | gate | done (partial � bootstrap gate pending) |\n**STEP=6**\n',
      expectStep: '6',
    },
    {
      name: 'explicit pending',
      track: '## Status: **open**\n| 6 | gate | pending |\n**STEP=6**\n',
      expectStep: '6',
    },
    {
      name: 'closed partial + next pending row',
      track: '## Status: **open** STEP=7\n| 6 | gate | done (partial) |\n| 7 | bootstrap gate | pending |\n**STEP=7**\n',
      expectStep: '7',
    },
  ];

  it.each(cases)('pick: $name', ({ track, expectStep }) => {
    fs.writeFileSync(path.join(agentDir, 'TRACK_BOOTSTRAP_LINK.md'), track);
    const t = trackFromContent('TRACK_BOOTSTRAP_LINK', track);
    const next = pickNextFromState({
      tracks: [t],
      session: { driverTurnsSincePlan: 8 },
      agentDir,
    });
    expect(next.role).toBe('Driver');
    expect(next.step).toBe(expectStep);
  });

  it.each(cases)('guard unblocks Planner dedup: $name', ({ track, expectStep }) => {
    fs.writeFileSync(path.join(agentDir, 'TRACK_BOOTSTRAP_LINK.md'), track);
    const planMsg = {
      role: 'user' as const,
      text: 'ROLE=Planner\nSTEP=plan-refresh\n@docs/agent/TRACK_PLAN.md\nx',
    };
    const p = planGuardNudge({
      composerId: 'c1',
      agentDir,
      messages: [planMsg, { role: 'assistant', text: 'a' }, planMsg, { role: 'assistant', text: 'b' }],
      token: 'cr-agent-t',
      targetId: 'mlc',
    });
    expect(p.action).toBe('send');
    if (p.action === 'send') {
      expect(p.role).toBe('Driver');
      expect(p.step).toBe(expectStep);
    }
  });
});
