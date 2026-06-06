import fs from 'fs';
import path from 'path';

export const INSTRUCTIONS_REV = '2026-05-28-cleaner';

export interface TrackInfo {
  file: string;
  name: string;
  closed: boolean;
  closedAt?: string;
  inProgress: boolean;
  pendingSteps: number[];
  pendingMeta?: Set<number>;
  nextStep?: number;
  focus: 'stability' | 'security' | 'performance' | 'architecture' | 'tooling';
  previousFile?: string;
  hasBlockedSkip?: boolean;
}

export interface SessionInfo {
  driverTurnsSincePlan: number;
  roleLast?: string;
  stepLast?: string;
  activeTrack?: string;
}

export type AgentRole = 'Driver' | 'Planner' | 'Backlog' | 'Meta' | 'Critic' | 'Orchestrator' | 'Cleaner' | 'Blogger' | 'Reviewer' | 'OrchestratorDev' | 'Monitor' | 'Researcher';

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
  let closedAt: string | undefined;
  if (closed) {
    // prefer explicit date in status line
    const m = content.match(/## Status:\s*\*\*closed\*\*[^(\n]*\([^)]*?(\d{4}-\d{2}-\d{2})/);
    if (m) {
      closedAt = m[1];
    } else {
      // fall back to file mtime
      try {
        closedAt = fs.statSync(filePath).mtime.toISOString().slice(0, 10);
      } catch { /* ignore */ }
    }
  }
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
  // extract previous track name (e.g. "[TRACK_TYPE_ALIASES.md](..." → "TRACK_TYPE_ALIASES.md")
  const prevMatch = content.match(/previous:\s*\[?(TRACK_\w+\.md)\]?/i);
  const previousFile = prevMatch?.[1] ?? undefined;
  const hasBlockedSkip = /skip\s*[—–-]\s*blocker:/i.test(content);
  return {
    file: path.basename(filePath),
    name,
    closed,
    closedAt,
    inProgress,
    pendingSteps,
    pendingMeta,
    nextStep,
    focus: trackFocus(name, content),
    previousFile,
    hasBlockedSkip,
  };
}

export function parseSession(sessionPath: string): SessionInfo {
  const content = fs.readFileSync(sessionPath, 'utf8');
  const lastNumericMatch = (re: RegExp) =>
    [...content.matchAll(re)].map((m) => m[1].trim()).filter((v) => /^\d+$/.test(v)).pop();
  const lastMatch = (re: RegExp) =>
    [...content.matchAll(re)].map((m) => m[1].trim()).filter((v) => !v.startsWith('<')).pop();
  const driver = lastNumericMatch(/driver_turns_since_plan\s*\|\s*([^|\n]+)/g);
  const role = lastMatch(/role_last\s*\|\s*([^|\n]+)/g);
  const step = lastMatch(/step_last\s*\|\s*([^|\n]+)/g);
  const track = lastMatch(/TRACK_\w+\s*\|\s*([^\n|]+)/g);
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

export function primaryTrackFile(tracks: TrackInfo[], isCr: boolean): string {
  const closedSet = new Set(tracks.filter((t) => t.closed).map((t) => t.file));
  const sort = (a: TrackInfo, b: TrackInfo) =>
    FOCUS_ORDER.indexOf(a.focus) - FOCUS_ORDER.indexOf(b.focus);
  // prefer tracks whose predecessor is closed (or has no predecessor)
  const ready = (t: TrackInfo) => !t.previousFile || closedSet.has(t.previousFile);
  const active = tracks.filter((t) => t.inProgress && t.pendingSteps.length > 0 && ready(t)).sort(sort);
  if (active.length) return active[0].file;
  // fallback: any open track
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
  const m = content.match(new RegExp(`\\|\\s*${step}\\s*\\|[^|\\n]*\\|\\s*(done[^|]*|pending|skip)\\s*\\|`, 'i'));
  if (!m) return 'unknown';
  const status = m[1].trim().toLowerCase();
  return (status.startsWith('done') || status === 'skip') ? 'done' : 'pending';
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
  if (!isCr && driverTurns % 25 === 0) {
    const postsDir = '/home/jenya/workspaces/web/izkaregn-website-2025/mlc-blog/posts';
    const lastPost = fs.existsSync(postsDir)
      ? fs.readdirSync(postsDir)
          .filter((f) => f.endsWith('.html'))
          .map((f) => fs.statSync(path.join(postsDir, f)).mtimeMs)
          .reduce((max, t) => Math.max(max, t), 0)
      : 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (Date.now() - lastPost >= oneDayMs) {
      return {
        role: 'Blogger',
        step: 'blog-post',
        trackFile: 'TRACK_PLAN.md',
        focus: 'stability',
        reason: '25 driver turns - write blog post about recent progress',
        refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/BLOG.md', '@docs/agent/TRACK_PLAN.md'],
      };
    }
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
  if (driverTurns % 18 === 0) {
    return {
      role: 'Monitor',
      step: 'process-monitor',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '18 driver turns - process health check',
      refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/MONITOR.md', '@docs/agent/SESSION.md'],
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
  if (!isCr && driverTurns % 35 === 0) {
    return {
      role: 'Reviewer',
      step: 'history-review',
      trackFile: 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '35 driver turns - review closed tracks for missed work',
      refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/REVIEWER.md', '@docs/agent/PLAN.md'],
    };
  }
  if (!isCr && driverTurns % 5 === 0) {
    const orchTrack = '/home/jenya/workspaces/current/mlc/docs/agent/TRACK_ORCH_DEV.md';
    const hasOpenSteps = fs.existsSync(orchTrack)
      ? fs.readFileSync(orchTrack, 'utf8').includes('| pending |')
      : false;
    if (hasOpenSteps) {
      return {
        role: 'OrchestratorDev',
        step: 'orch-dev',
        trackFile: 'TRACK_ORCH_DEV.md',
        focus: 'stability',
        reason: '5 driver turns - orchestrator/cr development step',
        refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/TRACK_ORCH_DEV.md'],
      };
    }
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

  // If active track has blocked skips but no pending steps → Planner to resolve blockers
  const blockedTracks = tracks.filter(
    (t) => t.inProgress && t.pendingSteps.length === 0 && t.hasBlockedSkip
  );
  if (blockedTracks.length > 0 && sess.roleLast !== 'Planner') {
    return {
      role: 'Planner',
      step: 'plan-refresh',
      trackFile: blockedTracks[0].file,
      focus: 'stability',
      reason: `${blockedTracks[0].file} has skip steps with unresolved blockers — create new tracks`,
      refs: isCr
        ? ['@docs/agent/CONTINUITY.md', `@docs/agent/${blockedTracks[0].file}`, '@docs/agent/RESEARCH.md']
        : ['@docs/agent/CONTINUITY.md', `@docs/agent/${blockedTracks[0].file}`, '@docs/agent/RESEARCH.md', '@docs/agent/PLAN.md'],
    };
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

  // No pending steps. Determine how many consecutive non-Driver turns already happened.
  const roleLast = sess.roleLast ?? '';
  const idleRoles: AgentRole[] = ['Planner', 'Researcher', 'Backlog', 'Reviewer'];
  const consecutiveIdle = idleRoles.includes(roleLast as AgentRole) ? 1 : 0;
  // If Planner just ran and still nothing → Researcher to find new work
  if (consecutiveIdle > 0 && roleLast === 'Planner') {
    return {
      role: 'Researcher',
      step: 'research-turn',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: 'Planner ran but no pending steps created — find new work via RESEARCH.md',
      refs: isCr
        ? ['@docs/agent/CONTINUITY.md', '@docs/agent/RESEARCH.md']
        : ['@docs/agent/CONTINUITY.md', '@docs/agent/RESEARCH.md', '@docs/agent/PLAN.md'],
    };
  }
  // If Researcher just ran and still nothing → Backlog to check hygiene/drift
  if (consecutiveIdle > 0 && roleLast === 'Researcher') {
    return {
      role: 'Backlog',
      step: 'backlog-review',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: 'Researcher ran but still no pending steps — check git vs TRACK drift',
      refs: isCr
        ? ['@docs/agent/CONTINUITY.md', '@docs/agent/TRACK_ORCH.md']
        : ['@docs/agent/CONTINUITY.md', '@docs/agent/TRACK_PLAN.md', '@docs/agent/PLAN.md'],
    };
  }
  // If Backlog/Reviewer just ran and still nothing → Planner again (last resort)
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
              : next.role === 'Blogger'
              ? 'Write blog post about recently closed tracks. See BLOG.md for format and deploy instructions. Skip if nothing significant since last post.'
              : next.role === 'Reviewer'
              ? 'Review last 5-7 closed TRACK_*.md files for missed steps, TODOs, deferred work. Create new tracks or RESEARCH entries as needed. See REVIEWER.md.'
              : next.role === 'OrchestratorDev'
              ? 'Take next pending step from TRACK_ORCH_DEV.md. Work in cr workspace only. npm test gate. No compiler/ changes.'
              : next.role === 'Monitor'
              ? 'Check process health: SESSION.md updated, tracks progressing, cr logs fresh, role rotation working, plans non-empty. See MONITOR.md checklist. Output: one line "Monitor: OK" or "Monitor: WARN — <reason>" in SESSION. Queue corrective role if needed.'
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
