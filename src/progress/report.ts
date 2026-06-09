import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { listTracks, primaryTrackFile } from '../cursor/agent_next';
import { getAgentState, type AgentStateEntry } from '../cursor/agent-state';
import { AGENT_TARGETS } from '../cursor/agent-targets';
import { listMeetings } from '../meetings/sync';
import { loadCachedSessionTurns } from '../session/sync';

const LOG_PATH = process.env.CR_OVERNIGHT_LOG ?? path.join(os.homedir(), '.cursor/cr-overnight.log');

export interface TrackProgress {
  file: string;
  closed: boolean;
  closedAt?: string;
  inProgress: boolean;
  isPrimary: boolean;
  done: number;
  total: number;
  pendingSteps: number[];
}

export interface LogEntry {
  at: string;
  msg: string;
  target?: string;
  role?: string;
  step?: string;
  reason?: string;
  err?: string;
  phase?: string;
  [k: string]: unknown;
}

export interface SessionTurn {
  date: string;
  title: string;
  role: string;
  step: string;
  done: string;
  gate: string;
}

export interface GitCommit {
  hash: string;
  time: string;
  msg: string;
}

export interface MeetingSummary {
  slug: string;
  topic: string;
  path: string;
  startedAt: string;
  endedAt: string | null;
}

export interface ProgressReport {
  loopRunning: boolean;
  lastTickAt: string | null;
  lastTickAgoMs: number | null;
  agentState: AgentStateEntry | null;
  recentActivity: LogEntry[];
  errors: LogEntry[];
  tracks: TrackProgress[];
  sessionTurns: SessionTurn[];
  meetings: MeetingSummary[];
  recentCommits: GitCommit[];
  plannedItems: string[];
}

function isLockHeld(): boolean {
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    execSync('pgrep -f overnight-loop\\.sh', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function readLastLogLines(n = 80): LogEntry[] {
  try {
    const text = fs.readFileSync(LOG_PATH, 'utf8');
    const lines = text.trimEnd().split('\n').slice(-n);
    return lines.flatMap((l) => {
      try { return [JSON.parse(l) as LogEntry]; } catch { return []; }
    });
  } catch {
    return [];
  }
}

function readRecentCommits(repoDir: string, n = 15): GitCommit[] {
  try {
    const out = execSync(
      `git -C "${repoDir}" log -${n} --format="%h|%ai|%s"`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }
    );
    return out.trim().split('\n').filter(Boolean).map((line) => {
      const idx1 = line.indexOf('|');
      const idx2 = line.indexOf('|', idx1 + 1);
      return {
        hash: line.slice(0, idx1).trim(),
        time: line.slice(idx1 + 1, idx2).trim().replace('T', ' ').replace(/\.\d+[+-]\d{2}:\d{2}$/, '').replace(/ \+\d{4}$/, ''),
        msg: line.slice(idx2 + 1).trim(),
      };
    });
  } catch {
    return [];
  }
}

function countSteps(agentDir: string, file: string): { done: number; total: number } {
  try {
    const content = fs.readFileSync(path.join(agentDir, file), 'utf8');
    const rows = [...content.matchAll(/\|\s*\d+\s*\|[^|\n]*\|\s*(done[^|]*|pending|skip)\s*\|/gi)];
    const done = rows.filter((m) => /^done|^skip/i.test(m[1].trim())).length;
    return { done, total: rows.length };
  } catch {
    return { done: 0, total: 0 };
  }
}

function parsePlannedItems(agentDir?: string): string[] {
  if (!agentDir) return [];
  try {
    const planPath = path.join(agentDir, '../..', 'docs', 'PLAN.md');
    if (!fs.existsSync(planPath)) return [];
    const content = fs.readFileSync(planPath, 'utf8');
    // Extract Phase headers and their first descriptive line
    const items: string[] = [];
    for (const m of content.matchAll(/^### (Phase \S+[^\n]*)\n([^\n]*)/gm)) {
      const phase = m[1].trim();
      const desc = m[2].replace(/^\*\*Goal\*\*:\s*/i, '').trim();
      if (desc) items.push(`${phase}: ${desc}`);
      else items.push(phase);
      if (items.length >= 8) break;
    }
    return items;
  } catch {
    return [];
  }
}

export function buildProgressReport(): ProgressReport {
  const primary = AGENT_TARGETS.find((t) => t.id === 'mlc') ?? AGENT_TARGETS[0];

  const loopRunning = isLockHeld();

  const lines = readLastLogLines(100);
  const ticks = lines.filter((l) => l.msg === 'tick');
  const lastTick = ticks[ticks.length - 1] ?? null;
  const lastTickAt = lastTick?.at ?? null;
  const lastTickAgoMs = lastTickAt ? Date.now() - new Date(lastTickAt).getTime() : null;

  const recentActivity = lines
    .filter((l) => !['tick', 'agent state'].includes(l.msg))
    .slice(-20);

  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  const errors = lines.filter(
    (l) => (l.msg === 'error' || l.msg === 'send failed') && new Date(l.at).getTime() > cutoff
  );

  let agentState: AgentStateEntry | null = null;
  let tracks: TrackProgress[] = [];
  let sessionTurns: SessionTurn[] = [];
  let meetings: MeetingSummary[] = [];
  let recentCommits: GitCommit[] = [];

  if (primary) {
    agentState = getAgentState(primary.id).agents[0] ?? null;
    try {
      const raw = listTracks(primary.agentDir);
      const primaryFile = primaryTrackFile(raw, false);
      tracks = raw.map((t) => {
        const { done, total } = countSteps(primary.agentDir, t.file);
        return {
          file: t.file,
          closed: t.closed,
          closedAt: t.closedAt,
          inProgress: t.inProgress,
          isPrimary: t.file === primaryFile,
          done,
          total,
          pendingSteps: t.pendingSteps,
        };
      });
    } catch {
      tracks = [];
    }
    sessionTurns = loadCachedSessionTurns(primary.agentDir);
    meetings = listMeetings(path.join(primary.agentDir, 'meetings'));
    const repoDir = path.join(primary.agentDir, '../..');
    recentCommits = readRecentCommits(repoDir);
  }

  const plannedItems = parsePlannedItems(primary?.agentDir);

  return {
    loopRunning,
    lastTickAt,
    lastTickAgoMs,
    agentState,
    recentActivity,
    errors,
    tracks,
    sessionTurns,
    meetings,
    recentCommits,
    plannedItems,
  };
}
