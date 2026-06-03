import { pickRoleByRotation } from '../../src/cursor/agent_next';

describe('pickRoleByRotation', () => {
  it('Orchestrator at 16 beats Critic at 6 boundary', () => {
    const r = pickRoleByRotation(16, true)!;
    expect(r.role).toBe('Orchestrator');
  });

  it('Critic at 6', () => {
    expect(pickRoleByRotation(6, true)!.role).toBe('Critic');
  });

  it('Cleaner at 10', () => {
    expect(pickRoleByRotation(10, true)!.role).toBe('Cleaner');
  });

  it('Planner at 8 for mlc only', () => {
    expect(pickRoleByRotation(8, false)!.role).toBe('Planner');
    expect(pickRoleByRotation(8, true)?.role).not.toBe('Planner');
  });

  it('Driver path when no rotation', () => {
    expect(pickRoleByRotation(5, true)).toBeNull();
  });
});
