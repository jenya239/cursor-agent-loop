import fs from 'fs';
import path from 'path';
import { peekSelfQueue } from './self-queue';
import { parseTrackContent, stepStatusInContent } from '../orchestration/track/parse-content';
import { parseSessionContent, recordSessionNudge } from '../orchestration/session/parse-session';
import { INSTRUCTIONS_REV, isCrAgentDir } from '../orchestration/pick/constants';
import {
  advanceDoneDriverStep,
  pickDriverFromTracks,
  pickNextFromState,
  primaryTrackFile,
} from '../orchestration/pick/pick-next';
import { pickRoleByRotation } from '../orchestration/pick/role-rotation';
import { buildNudgePrompt } from '../orchestration/prompt/build-nudge';
import type { AgentRole, NextAgentStep, SessionInfo, TrackInfo } from '../orchestration/types';

export type { AgentRole, NextAgentStep, SessionInfo, TrackInfo };
export { INSTRUCTIONS_REV, buildNudgePrompt, pickRoleByRotation, primaryTrackFile };

export function parseTrackFile(filePath: string): TrackInfo | null {
  const base = path.basename(filePath, '.md');
  if (!base.startsWith('TRACK_')) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = parseTrackContent(base, content);
  let closedAt = parsed.closedAt;
  if (parsed.closed && !closedAt) {
    try {
      closedAt = fs.statSync(filePath).mtime.toISOString().slice(0, 10);
    } catch { /* ignore */ }
  }
  return {
    file: `${base}.md`,
    name: parsed.name,
    closed: parsed.closed,
    closedAt,
    inProgress: parsed.inProgress,
    pendingSteps: parsed.pendingSteps,
    pendingMeta: parsed.pendingMeta,
    nextStep: parsed.nextStep,
    focus: parsed.focus,
    previousFile: parsed.previousFile,
    hasBlockedSkip: parsed.hasBlockedSkip,
  };
}

export function parseSession(sessionPath: string): SessionInfo {
  return parseSessionContent(fs.readFileSync(sessionPath, 'utf8'));
}

export function listTracks(agentDir: string): TrackInfo[] {
  return fs
    .readdirSync(agentDir)
    .filter((f) => f.startsWith('TRACK_') && f.endsWith('.md'))
    .map((f) => parseTrackFile(path.join(agentDir, f))!)
    .filter(Boolean);
}

export function recordGuardNudge(sessionPath: string, next: NextAgentStep): void {
  if (!fs.existsSync(sessionPath)) return;
  const sess = parseSession(sessionPath);
  const driverTurns =
    next.role === 'Driver' ? sess.driverTurnsSincePlan + 1 : sess.driverTurnsSincePlan;
  const content = recordSessionNudge(fs.readFileSync(sessionPath, 'utf8'), {
    role: next.role,
    step: next.step,
    instructionsRev: INSTRUCTIONS_REV,
    driverTurnsSincePlan: driverTurns,
  });
  fs.writeFileSync(sessionPath, content);
}

export function trackStepStatus(trackPath: string, step: string): 'pending' | 'done' | 'unknown' {
  if (!fs.existsSync(trackPath)) return 'unknown';
  return stepStatusInContent(fs.readFileSync(trackPath, 'utf8'), step);
}

function rotationDeps(agentDir: string) {
  const isCr = isCrAgentDir(agentDir);
  return {
    hasOrchDevPending: () => {
      if (isCr) return false;
      const p = '/home/jenya/workspaces/current/mlc/docs/agent/TRACK_ORCH_DEV.md';
      return fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes('| pending |');
    },
    shouldBlog: () => {
      if (isCr) return false;
      const postsDir = '/home/jenya/workspaces/web/izkaregn-website-2025/mlc-blog/posts';
      if (!fs.existsSync(postsDir)) return false;
      const lastPost = fs
        .readdirSync(postsDir)
        .filter((f) => f.endsWith('.html'))
        .map((f) => fs.statSync(path.join(postsDir, f)).mtimeMs)
        .reduce((max, t) => Math.max(max, t), 0);
      return Date.now() - lastPost >= 24 * 60 * 60 * 1000;
    },
  };
}

export function advanceIfStepDone(agentDir: string, next: NextAgentStep): NextAgentStep {
  const tracks = listTracks(agentDir);
  return advanceDoneDriverStep(next, tracks, (trackFile, step) => {
    return trackStepStatus(path.join(agentDir, trackFile), step) === 'done';
  });
}

export function pickDriverStep(agentDir: string): NextAgentStep | null {
  const next = pickDriverFromTracks(listTracks(agentDir), agentDir);
  return next ? advanceIfStepDone(agentDir, next) : null;
}

export function pickNextAgentStep(agentDir: string, session?: SessionInfo): NextAgentStep {
  const tracks = listTracks(agentDir);
  const sess = session ?? parseSession(path.join(agentDir, 'SESSION.md'));
  const selfQueued = peekSelfQueue(agentDir);
  const next = pickNextFromState({
    tracks,
    session: sess,
    agentDir,
    selfQueued,
    rotationDeps: rotationDeps(agentDir),
  });
  return next.role === 'Driver' ? advanceIfStepDone(agentDir, next) : next;
}
