import type { TrackInfo } from '../../../src/orchestration/types';
import { pickNextFromState, pickDriverFromTracks } from '../../../src/orchestration/pick/pick-next';

const openTrack: TrackInfo = {
  file: 'TRACK_BOOTSTRAP_LINK.md',
  name: 'TRACK_BOOTSTRAP_LINK',
  closed: false,
  inProgress: true,
  pendingSteps: [6],
  focus: 'stability',
};

describe('pickNextFromState', () => {
  it('Driver beats Planner rotation at driver_turns=8', () => {
    const next = pickNextFromState({
      tracks: [openTrack],
      session: { driverTurnsSincePlan: 8, roleLast: 'Driver' },
      agentDir: '/home/jenya/workspaces/current/mlc/docs/agent',
    });
    expect(next.role).toBe('Driver');
    expect(next.step).toBe('6');
  });

  it('Driver beats Critic rotation at driver_turns=6', () => {
    const next = pickNextFromState({
      tracks: [openTrack],
      session: { driverTurnsSincePlan: 6 },
      agentDir: '/home/jenya/workspaces/current/mlc/docs/agent',
    });
    expect(next.role).toBe('Driver');
  });

  it('Planner when no pending tracks', () => {
    const next = pickNextFromState({
      tracks: [],
      session: { driverTurnsSincePlan: 3 },
      agentDir: '/home/jenya/workspaces/current/mlc/docs/agent',
    });
    expect(next.role).toBe('Planner');
  });

  it('Researcher after Planner idle', () => {
    const next = pickNextFromState({
      tracks: [],
      session: { driverTurnsSincePlan: 3, roleLast: 'Planner' },
      agentDir: '/home/jenya/workspaces/current/mlc/docs/agent',
    });
    expect(next.role).toBe('Researcher');
  });

  it('pickDriverFromTracks on open-not-inProgress track', () => {
    const t: TrackInfo = { ...openTrack, inProgress: false };
    const d = pickDriverFromTracks([t], '/home/jenya/workspaces/current/mlc/docs/agent');
    expect(d?.role).toBe('Driver');
    expect(d?.step).toBe('6');
  });
});
