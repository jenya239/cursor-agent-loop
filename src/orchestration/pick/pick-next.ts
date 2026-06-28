import type { NextAgentStep, SessionInfo, TrackInfo } from '../types';
import { isCrAgentDir, sortByFocus } from './constants';
import { pickRoleByRotation, type RotationDeps } from './role-rotation';

export function primaryTrackFile(tracks: TrackInfo[], isCr: boolean): string {
  const closedSet = new Set(tracks.filter((t) => t.closed).map((t) => t.file));
  const ready = (t: TrackInfo) => !t.previousFile || closedSet.has(t.previousFile);
  const active = sortByFocus(
    tracks.filter((t) => t.inProgress && t.pendingSteps.length > 0 && ready(t))
  );
  if (active.length) return active[0].file;
  const open = sortByFocus(tracks.filter((t) => !t.closed && t.pendingSteps.length > 0));
  if (open.length) return open[0].file;
  return isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md';
}

export function activeTracksWithPending(tracks: TrackInfo[]): TrackInfo[] {
  return sortByFocus(tracks.filter((t) => t.inProgress && t.pendingSteps.length > 0));
}

export function openTracksWithPending(tracks: TrackInfo[]): TrackInfo[] {
  return sortByFocus(tracks.filter((t) => !t.closed && t.pendingSteps.length > 0));
}

export function driverStepFromTrack(t: TrackInfo, isCr: boolean): NextAgentStep {
  const step = t.nextStep ?? t.pendingSteps[0];
  const refs = isCr
    ? ['@docs/agent/CONTINUITY.md', `@docs/agent/${t.file}`]
    : ['@docs/agent/CONTINUITY.md', '@docs/agent/DEVELOPMENT.md', `@docs/agent/${t.file}`];
  return {
    role: 'Driver',
    step: String(step),
    trackFile: t.file,
    focus: t.focus,
    reason: `pending STEP=${step} in ${t.name}`,
    refs,
  };
}

export function pickDriverFromTracks(tracks: TrackInfo[], agentDir: string): NextAgentStep | null {
  const isCr = isCrAgentDir(agentDir);
  const active = activeTracksWithPending(tracks);
  if (active.length) {
    const t = active[0];
    const step = t.nextStep ?? t.pendingSteps[0];
    if (t.pendingMeta?.has(step)) {
      return {
        role: 'Meta',
        step: 'meta-review',
        trackFile: t.file,
        focus: t.focus,
        reason: `TRACK step ${step} is meta-review`,
        refs: isCr
          ? ['@docs/agent/CONTINUITY.md', '@docs/agent/TRACK_ORCH.md', '@docs/agent/RESEARCH.md']
          : ['@docs/agent/CONTINUITY.md', `@docs/agent/${t.file}`],
      };
    }
    return driverStepFromTrack(t, isCr);
  }
  const open = openTracksWithPending(tracks);
  if (open.length) {
    const t = open[0];
    return {
      ...driverStepFromTrack(t, isCr),
      reason: `resume ${t.name} STEP=${t.pendingSteps[0]}`,
      step: String(t.pendingSteps[0]),
    };
  }
  return null;
}

export function advanceDoneDriverStep(
  next: NextAgentStep,
  tracks: TrackInfo[],
  stepDone: (trackFile: string, step: string) => boolean
): NextAgentStep {
  if (next.role !== 'Driver' || !/^\d+$/.test(next.step)) return next;
  if (!stepDone(next.trackFile, next.step)) return next;
  const candidates = sortByFocus(
    tracks.filter((t) => (t.inProgress || !t.closed) && t.pendingSteps.length > 0)
  );
  if (!candidates.length) return next;
  const t = candidates[0];
  const step = t.nextStep ?? t.pendingSteps[0];
  return {
    ...next,
    step: String(step),
    trackFile: t.file,
    reason: `STEP=${next.step} already done in ${next.trackFile}; advance to ${step}`,
  };
}

export function pickNextFromState(input: {
  tracks: TrackInfo[];
  session: SessionInfo;
  agentDir: string;
  selfQueued?: NextAgentStep | null;
  rotationDeps?: RotationDeps;
}): NextAgentStep {
  const { tracks, session, agentDir } = input;
  const isCr = isCrAgentDir(agentDir);

  if (input.selfQueued) return input.selfQueued;

  const driver = pickDriverFromTracks(tracks, agentDir);
  if (driver) return driver;

  const rotated = pickRoleByRotation(session.driverTurnsSincePlan, isCr, input.rotationDeps);
  if (rotated) {
    if (rotated.role === 'Critic') {
      rotated.trackFile = primaryTrackFile(tracks, isCr);
      if (!rotated.refs.some((r) => r.includes('TRACK_'))) {
        rotated.refs.push(`@docs/agent/${rotated.trackFile}`);
      }
    }
    return rotated;
  }

  const blockedTracks = tracks.filter(
    (t) => t.inProgress && t.pendingSteps.length === 0 && t.hasBlockedSkip
  );
  if (blockedTracks.length > 0 && session.roleLast !== 'Planner') {
    return {
      role: 'Planner',
      step: 'plan-refresh',
      trackFile: blockedTracks[0].file,
      focus: 'stability',
      reason: `${blockedTracks[0].file} has skip steps with unresolved blockers � create new tracks`,
      refs: isCr
        ? ['@docs/agent/CONTINUITY.md', `@docs/agent/${blockedTracks[0].file}`, '@docs/agent/RESEARCH.md']
        : [
            '@docs/agent/CONTINUITY.md',
            `@docs/agent/${blockedTracks[0].file}`,
            '@docs/agent/RESEARCH.md',
            '@docs/agent/PLAN.md',
          ],
    };
  }

  const roleLast = session.roleLast ?? '';
  if (roleLast === 'Planner') {
    return {
      role: 'Researcher',
      step: 'research-turn',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: 'Planner ran but no pending steps created � find new work via RESEARCH.md',
      refs: isCr
        ? ['@docs/agent/CONTINUITY.md', '@docs/agent/RESEARCH.md']
        : ['@docs/agent/CONTINUITY.md', '@docs/agent/RESEARCH.md', '@docs/agent/PLAN.md'],
    };
  }
  if (roleLast === 'Researcher') {
    return {
      role: 'Backlog',
      step: 'backlog-review',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: 'Researcher ran but still no pending steps � check git vs TRACK drift',
      refs: isCr
        ? ['@docs/agent/CONTINUITY.md', '@docs/agent/TRACK_ORCH.md']
        : ['@docs/agent/CONTINUITY.md', '@docs/agent/TRACK_PLAN.md', '@docs/agent/PLAN.md'],
    };
  }

  return {
    role: 'Planner',
    step: 'plan-refresh',
    trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
    focus: 'stability',
    reason: 'all tracks closed - open next by stability > security > performance',
    refs: isCr
      ? ['@docs/agent/CONTINUITY.md', '@docs/agent/RESEARCH.md', '@docs/agent/TRACK_ORCH.md']
      : [
          '@docs/agent/CONTINUITY.md',
          '@docs/agent/PLAN.md',
          '@docs/agent/TRACK_PLAN.md',
          '@docs/agent/TRACK_PHASE1.md',
        ],
  };
}
