import fs from 'fs';
import path from 'path';

export const INSTRUCTIONS_REV = '2026-05-28-cleaner';

export interface TrackInfo {
  file: string;
  name: string;
  closed: boolean;
  inProgress: boolean;
  pendingSteps: number[];
  pendingMeta?: Set<number>;
  nextStep?: number;
  focus: 'stability' | 'security' | 'performance' | 'architecture' | 'tooling';
}

export interface SessionInfo {
  driverTurnsSincePlan: number;
  roleLast?: string;
  stepLast?: string;
  activeTrack?: string;
}

export type AgentRole = 'Driver' | 'Planner' | 'Backlog' | 'Meta' | 'Critic' | 'Orchestrator' | 'Cleaner';

export interface NextAgentStep {
  role: AgentRole;
  step: string;
  trackFile: string;
  focus: TrackInfo['focus'];
  reason: string;
  refs: string[];
}

const FOCUS_ORDER: TrackInfo['focus'][] = ['stability', 'security', 'performance', 'architecture', 'tooling'];

const TRACK_FOCUS: Record<string, TrackInfo['focus']> = {
  TRACK_PHASE1: 'stability',
  TRACK_ORCH: 'stability',
  TRACK_CPPEXPR: 'architecture',
  TRACK_CPPGEN: 'architecture',
  TRACK_PLAN: 'architecture',
  TRACK_DIAGNOSTICS2: 'stability',
};

function trackFocus(name: string, content: string): TrackInfo['focus'] {
  if (TRACK_FOCUS[name]) return TRACK_FOCUS[name];
  if (/crash|fuzz|safety|security/i.test(content)) return 'security';
  if (/perf|benchmark|speed|optim/i.test(content)) return 'performance';
  return 'stability';
}

export function parseTrackFile(filePath: string): TrackInfo | null {
  const base = path.basename(filePath, '.md');
  if (!base.startsWith('TRACK_')) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const name = base;
  const closed = /## Status:\s*\*\*closed\*\*|Status:\s*closed/i.test(content);
  const inProgress =
    !closed &&
    (/in progress/i.test(content) ||
      /Status:\s*\*\*(active|open)\*\*/i.test(content) ||
      /Status:\s*(active|open)/i.test(content));
  const pendingSteps: number[] = [];
  const pendingMeta = new Set<number>();
  for (const m of content.matchAll(/\|\s*(\d+)\s*\|([^|\n]*)\|\s*pending\s*\|/gi)) {
    const n = Number(m[1]);
    pendingSteps.push(n);
    if (/meta-review|meta review/i.test(m[2])) pendingMeta.add(n);
  }
  pendingSteps.sort((a, b) => a - b);
  const nextMatch = content.match(/\*\*STEP=(\d+)\*\*/);
  const nextStep = nextMatch ? Number(nextMatch[1]) : pendingSteps[0];
  return {
    file: path.basename(filePath),
    name,
    closed,
    inProgress,
    pendingSteps,
    pendingMeta,
    nextStep,
    focus: trackFocus(name, content),
  };
}

export function parseSession(sessionPath: string): SessionInfo {
  const content = fs.readFileSync(sessionPath, 'utf8');
  const driver = content.match(/driver_turns_since_plan\s*\|\s*([^|\n]+)/)?.[1];
  const role = content.match(/role_last\s*\|\s*([^|\n]+)/)?.[1];
  const step = content.match(/step_last\s*\|\s*([^|\n]+)/)?.[1];
  const track = content.match(/TRACK_\w+\s*\|\s*([^\n|]+)/)?.[1]?.trim();
  return {
    driverTurnsSincePlan: driver ? Number(driver.trim()) : 0,
    roleLast: role?.trim(),
    stepLast: step?.trim(),
    activeTrack: track,
  };
}

export function listTracks(agentDir: string): TrackInfo[] {
  return fs
    .readdirSync(agentDir)
    .filter((f) => f.startsWith('TRACK_') && f.endsWith('.md'))
    .map((f) => parseTrackFile(path.join(agentDir, f))!)
    .filter(Boolean);
}

function primaryTrackFile(tracks: TrackInfo[], isCr: boolean): string {
  const sort = (a: TrackInfo, b: TrackInfo) =>
    FOCUS_ORDER.indexOf(a.focus) - FOCUS_ORDER.indexOf(b.focus);
  const active = tracks.filter((t) => t.inProgress && t.pendingSteps.length > 0).sort(sort);
  if (active.length) return active[0].file;
  const open = tracks.filter((t) => !t.closed && t.pendingSteps.length > 0).sort(sort);
  if (open.length) return open[0].file;
  return isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md';
}

function patchSessionField(content: string, name: string, value: string): string {
  const re = new RegExp(`(\\|\\s*${name}\\s*\\|\\s*)([^\\n|]+)(\\s*\\|)`);
  return re.test(content) ? content.replace(re, `$1${value}$3`) : content;
}

/** After guard CDP send: keep SESSION rotation fields in sync. */
export function recordGuardNudge(sessionPath: string, next: NextAgentStep): void {
  if (!fs.existsSync(sessionPath)) return;
  const sess = parseSession(sessionPath);
  const driverTurns =
    next.role === 'Driver' ? sess.driverTurnsSincePlan + 1 : sess.driverTurnsSincePlan;
  let content = fs.readFileSync(sessionPath, 'utf8');
  content = patchSessionField(content, 'instructions_rev', `\`${INSTRUCTIONS_REV}\``);
  content = patchSessionField(content, 'role_last', next.role);
  content = patchSessionField(content, 'step_last', next.step);
  content = patchSessionField(content, 'driver_turns_since_plan', String(driverTurns));
  fs.writeFileSync(sessionPath, content);
}

export function trackStepStatus(trackPath: string, step: string): 'pending' | 'done' | 'unknown' {
  if (!/^\d+$/.test(step) || !fs.existsSync(trackPath)) return 'unknown';
  const content = fs.readFileSync(trackPath, 'utf8');
  const m = content.match(new RegExp(`\\|\\s*${step}\\s*\\|[^|\\n]*\\|\\s*(done|pending)\\s*\\|`, 'i'));
  return m ? (m[1].toLowerCase() as 'done' | 'pending') : 'unknown';
}

export function advanceIfStepDone(agentDir: string, next: NextAgentStep): NextAgentStep {
  if (next.role !== 'Driver' || !/^\d+$/.test(next.step)) return next;
  const trackPath = path.join(agentDir, next.trackFile);
  if (trackStepStatus(trackPath, next.step) !== 'done') return next;

  const tracks = listTracks(agentDir);
  const active = tracks
    .filter((t) => (t.inProgress || !t.closed) && t.pendingSteps.length > 0)
    .sort((a, b) => a.pendingSteps[0] - b.pendingSteps[0]);
  if (!active.length) return next;
  const t = active[0];
  const step = t.nextStep ?? t.pendingSteps[0];
  return {
    ...next,
    step: String(step),
    trackFile: t.file,
    reason: `STEP=${next.step} already done in ${next.trackFile}; advance to ${step}`,
  };
}

export function pickRoleByRotation(driverTurns: number, isCr: boolean): NextAgentStep | null {
  if (driverTurns <= 0) return null;
  if (driverTurns % 16 === 0) {
    return {
      role: 'Orchestrator',
      step: 'roles-review',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '16 driver turns - roles and rotation review',
      refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/ROLES.md'],
    };
  }
  if (driverTurns % 20 === 0) {
    return {
      role: 'Backlog',
      step: 'backlog-review',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '20 driver turns - hygiene review',
      refs: isCr
        ? ['@docs/agent/CONTINUITY.md', '@docs/agent/TRACK_ORCH.md']
        : ['@docs/agent/CONTINUITY.md', '@docs/agent/TRACK_PLAN.md', '@docs/agent/PLAN.md'],
    };
  }
  if (driverTurns % 12 === 0) {
    return {
      role: 'Meta',
      step: 'meta-review',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '12 driver turns - process and supervisor log',
      refs: isCr
        ? ['@docs/agent/CONTINUITY.md', '@docs/agent/TRACK_ORCH.md', '@docs/agent/RESEARCH.md']
        : ['@docs/agent/CONTINUITY.md', '@docs/agent/RESEARCH.md'],
    };
  }
  if (driverTurns % 10 === 0) {
    return {
      role: 'Cleaner',
      step: 'cleanup-sweep',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '10 driver turns - junk files and stale docs sweep',
      refs: isCr
        ? ['@docs/agent/CONTINUITY.md', '@docs/agent/ROLES.md']
        : ['@docs/agent/CONTINUITY.md', '@docs/agent/ROLES.md', '@docs/agent/DEVELOPMENT.md'],
    };
  }
  if (!isCr && driverTurns % 8 === 0) {
    return {
      role: 'Planner',
      step: 'plan-refresh',
      trackFile: 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '8 driver turns - plan refresh',
      refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/PLAN.md', '@docs/agent/TRACK_PLAN.md'],
    };
  }
  if (driverTurns % 6 === 0) {
    return {
      role: 'Critic',
      step: 'critique-audit',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '6 driver turns - re-audit recent done work',
      refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/ROLES.md', '@docs/agent/SESSION.md'],
    };
  }
  return null;
}

/** Pick only the Driver step from the active track, ignoring rotation. */
export function pickDriverStep(agentDir: string): NextAgentStep | null {
  const tracks = listTracks(agentDir);
  const isCr = agentDir.replace(/\\/g, '/').includes('/cr/docs/agent');
  const active = tracks
    .filter((t) => t.inProgress && t.pendingSteps.length > 0)
    .sort((a, b) => FOCUS_ORDER.indexOf(a.focus) - FOCUS_ORDER.indexOf(b.focus));
  if (!active.length) return null;
  const t = active[0];
  const step = t.nextStep ?? t.pendingSteps[0];
  const refs = isCr
    ? ['@docs/agent/CONTINUITY.md', `@docs/agent/${t.file}`]
    : ['@docs/agent/CONTINUITY.md', '@docs/agent/DEVELOPMENT.md', `@docs/agent/${t.file}`];
  return advanceIfStepDone(agentDir, {
    role: 'Driver',
    step: String(step),
    trackFile: t.file,
    focus: t.focus,
    reason: `pending STEP=${step} in ${t.name}`,
    refs,
  });
}

export function pickNextAgentStep(agentDir: string, session?: SessionInfo): NextAgentStep {
  const tracks = listTracks(agentDir);
  const sess = session ?? parseSession(path.join(agentDir, 'SESSION.md'));
  const isCr = agentDir.replace(/\\/g, '/').includes('/cr/docs/agent');

  const rotated = pickRoleByRotation(sess.driverTurnsSincePlan, isCr);
  if (rotated) {
    if (rotated.role === 'Critic') {
      rotated.trackFile = primaryTrackFile(tracks, isCr);
      if (!rotated.refs.some((r) => r.includes('TRACK_'))) {
        rotated.refs.push(`@docs/agent/${rotated.trackFile}`);
      }
    }
    return rotated;
  }

  const active = tracks
    .filter((t) => t.inProgress && t.pendingSteps.length > 0)
    .sort((a, b) => FOCUS_ORDER.indexOf(a.focus) - FOCUS_ORDER.indexOf(b.focus));

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
    const refs = isCr
      ? ['@docs/agent/CONTINUITY.md', `@docs/agent/${t.file}`]
      : ['@docs/agent/CONTINUITY.md', '@docs/agent/DEVELOPMENT.md', `@docs/agent/${t.file}`];
    return advanceIfStepDone(agentDir, {
      role: 'Driver',
      step: String(step),
      trackFile: t.file,
      focus: t.focus,
      reason: `pending STEP=${step} in ${t.name}`,
      refs,
    });
  }

  const openByFocus = tracks
    .filter((t) => !t.closed && t.pendingSteps.length > 0)
    .sort((a, b) => FOCUS_ORDER.indexOf(a.focus) - FOCUS_ORDER.indexOf(b.focus));

  if (openByFocus.length) {
    const t = openByFocus[0];
    const step = t.pendingSteps[0];
    return advanceIfStepDone(agentDir, {
      role: 'Driver',
      step: String(step),
      trackFile: t.file,
      focus: t.focus,
      reason: `resume ${t.name} STEP=${step}`,
      refs: isCr
        ? ['@docs/agent/CONTINUITY.md', `@docs/agent/${t.file}`]
        : ['@docs/agent/CONTINUITY.md', '@docs/agent/DEVELOPMENT.md', `@docs/agent/${t.file}`],
    });
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

export function buildNudgePrompt(next: NextAgentStep, token: string, targetId?: string): string {
  const focusLine =
    next.role === 'Planner'
      ? 'Priority: stability > security > performance.'
      : next.role === 'Meta'
        ? 'Log + supervisor. Update RESEARCH/TRACK. Mark meta steps done.'
        : next.role === 'Critic'
          ? 'Skeptical re-audit of last done steps vs git/tests. Reopen or fix sub-step if wrong.'
          : next.role === 'Orchestrator'
          ? 'Update ROLES.md rotation if needed. No code.'
          : next.role === 'Cleaner'
            ? 'Remove junk only: debug artifacts, stale docs, orphan dot-dirs. Keep active TRACK/PLAN/CONTINUITY/.cursor/rules. git status before delete.'
            : next.role === 'Backlog'
              ? 'PLAN vs TRACK vs git; flag drift. No compiler edits.'
              : `Focus: ${next.focus}. Verify gate from TRACK.`;

  const tail =
    targetId === 'cr'
      ? 'npm test gate. SESSION. register+enqueue Driver next pending step.'
      : 'SESSION. register+enqueue Driver next pending step.';

  return [
    `AGENT_TOKEN=${token}`,
    `INSTRUCTIONS_REV=${INSTRUCTIONS_REV}`,
    `ROLE=${next.role}`,
    `STEP=${next.step}`,
    ...next.refs,
    '',
    `${next.reason}. ${focusLine}`,
    tail,
  ].join('\n');
}
