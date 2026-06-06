import fs from 'fs';
import path from 'path';
import {
  parseTrackFile,
  pickNextAgentStep,
  recordGuardNudge,
  parseSession,
} from '../../src/cursor/agent_next';

const FIX = path.join(__dirname, '../fixtures/agent-next');

describe('agent-next tracks', () => {
  it('parses in progress track', () => {
    const t = parseTrackFile(path.join(FIX, 'TRACK_TEST.md'))!;
    expect(t.inProgress).toBe(true);
    expect(t.pendingSteps).toEqual([2]);
    expect(t.nextStep).toBe(2);
  });

  it('parses active status track', () => {
    const t = parseTrackFile(path.join(FIX, 'TRACK_ACTIVE.md'))!;
    expect(t.inProgress).toBe(true);
    expect(t.pendingSteps).toEqual([3]);
    expect(t.nextStep).toBe(3);
  });

  it('pickNext Driver from fixture', () => {
    const next = pickNextAgentStep(FIX);
    expect(next.role).toBe('Driver');
    expect(next.step).toBe('3');
  });

  it('recordGuardNudge bumps driver turns on Driver', () => {
    const sessionPath = path.join(FIX, 'SESSION_GUARD.md');
    fs.writeFileSync(
      sessionPath,
      '| driver_turns_since_plan | 3 |\n| role_last | Planner |\n| step_last | plan-refresh |\n| instructions_rev | `old` |\n'
    );
    recordGuardNudge(sessionPath, {
      role: 'Driver',
      step: '2',
      trackFile: 'TRACK_TEST.md',
      focus: 'stability',
      reason: 'test',
      refs: [],
    });
    const s = parseSession(sessionPath);
    expect(s.driverTurnsSincePlan).toBe(4);
    expect(s.roleLast).toBe('Driver');
    expect(s.stepLast).toBe('2');
    fs.unlinkSync(sessionPath);
  });

  it('falls back to Researcher when Planner ran but all tracks are closed', () => {
    const idleFix = path.join(__dirname, '../fixtures/agent-next-idle');
    const next = pickNextAgentStep(idleFix);
    expect(next.role).toBe('Researcher');
  });

  it('parseSession reads last numeric value, not template placeholder', () => {
    const s = parseSession(path.join(FIX, 'SESSION.md'));
    // fixture has template "<n; +1 after Driver, 0 after Planner>" as last line —
    // must return the last real numeric value (3), not NaN
    expect(s.driverTurnsSincePlan).toBe(3);
    expect(s.roleLast).toBe('Driver');
    expect(s.stepLast).toBe('3');
  });
});
