import fs from 'fs';
import path from 'path';
import os from 'os';
import { listTracks } from '../cursor/agent_next';
import { getAgentState, type AgentStateEntry } from '../cursor/agent-state';
import { AGENT_TARGETS } from '../cursor/agent-targets';

const LOG_PATH = process.env.CR_OVERNIGHT_LOG ?? path.join(os.homedir(), '.cursor/cr-overnight.log');

export interface TrackProgress {
  file: string;
  closed: boolean;
  inProgress: boolean;
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

export interface ProgressReport {
  loopRunning: boolean;
  lastTickAt: string | null;
  lastTickAgoMs: number | null;
  agentState: AgentStateEntry | null;
  recentActivity: LogEntry[];
  errors: LogEntry[];
  tracks: TrackProgress[];
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

function countSteps(agentDir: string, file: string): { done: number; total: number } {
  try {
    const content = fs.readFileSync(path.join(agentDir, file), 'utf8');
    const rows = [...content.matchAll(/\|\s*\d+\s*\|[^|\n]*\|\s*(done|pending)\s*\|/gi)];
    const done = rows.filter((m) => /done/i.test(m[1])).length;
    return { done, total: rows.length };
  } catch {
    return { done: 0, total: 0 };
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

  if (primary) {
    agentState = getAgentState(primary.id).agents[0] ?? null;
    try {
      const raw = listTracks(primary.agentDir);
      tracks = raw.map((t) => {
        const { done, total } = countSteps(primary.agentDir, t.file);
        return {
          file: t.file,
          closed: t.closed,
          inProgress: t.inProgress,
          done,
          total,
          pendingSteps: t.pendingSteps,
        };
      });
    } catch {
      tracks = [];
    }
  }

  return { loopRunning, lastTickAt, lastTickAgoMs, agentState, recentActivity, errors, tracks };
}
