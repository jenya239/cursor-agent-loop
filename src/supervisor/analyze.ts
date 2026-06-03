import fs from 'fs';
import path from 'path';
import { listTracks, pickNextAgentStep } from '../cursor/agent_next';
import { AGENT_TARGETS, type AgentTarget } from '../cursor/agent-targets';
import { isExpectedSendBlock } from '../cursor/guard-nudge';
import { promptKey, readOrchState } from '../cursor/loop-guard';
export type AlertSeverity = 'info' | 'warn' | 'critical';

export interface SupervisorAlert {
  id: string;
  severity: AlertSeverity;
  target?: string;
  code: string;
  message: string;
  since?: string;
  count?: number;
}

export interface SupervisorReport {
  at: string;
  alerts: SupervisorAlert[];
  ok: boolean;
}

const BLOCK_CODES = new Set(['step_stuck', 'send_fail_loop', 'no_window', 'enqueue_loop']);

export function loadSupervisorReport(statePath?: string): SupervisorReport | null {
  const p =
    statePath ||
    process.env.CR_SUPERVISOR_STATE ||
    path.join(process.env.HOME || '', '.cursor', 'cr-supervisor.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as SupervisorReport;
  } catch {
    return null;
  }
}

export function guardBlockedAlerts(report: SupervisorReport, targetId?: string): SupervisorAlert[] {
  return report.alerts.filter((a) => {
    if (a.severity !== 'critical' || !BLOCK_CODES.has(a.code)) return false;
    if (!targetId) return !a.target;
    return !a.target || a.target === targetId;
  });
}

interface LogLine {
  at?: string;
  msg?: string;
  target?: string;
  err?: string;
  step?: string;
  role?: string;
  usageMax?: number;
}

function readLogLines(logPath: string, tail = 200): LogLine[] {
  if (!fs.existsSync(logPath)) return [];
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').slice(-tail);
  const out: LogLine[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as LogLine);
    } catch {
      /* skip */
    }
  }
  return out;
}

function countRecent(lines: LogLine[], pred: (l: LogLine) => boolean, windowMs: number): number {
  const cutoff = Date.now() - windowMs;
  return lines.filter((l) => {
    if (!pred(l)) return false;
    const t = l.at ? Date.parse(l.at) : 0;
    return t >= cutoff;
  }).length;
}

function lastSentSteps(lines: LogLine[], target: string, n = 5): string[] {
  return lines
    .filter((l) => l.msg === 'sent' && l.target === target && l.step)
    .slice(-n)
    .map((l) => `${l.role}:${l.step}`);
}

function trackPendingStep(agentDir: string): string | null {
  if (!fs.existsSync(agentDir)) return null;
  const tracks = listTracks(agentDir);
  const t = tracks.find((x) => x.inProgress && x.pendingSteps.length);
  if (!t) return null;
  return String(t.nextStep ?? t.pendingSteps[0]);
}

export function analyzeSupervisor(opts?: {
  logPath?: string;
  windowMs?: number;
  targets?: AgentTarget[];
}): SupervisorReport {
  const logPath = opts?.logPath ?? path.join(process.env.HOME || '', '.cursor/cr-overnight.log');
  const windowMs = opts?.windowMs ?? 2 * 60 * 60_000;
  const targets = opts?.targets ?? AGENT_TARGETS;
  const lines = readLogLines(logPath);
  const alerts: SupervisorAlert[] = [];

  for (const t of targets) {
    const orch = readOrchState().byComposer[t.composerId];
    const nextKey = fs.existsSync(t.agentDir)
      ? promptKey(pickNextAgentStep(t.agentDir))
      : null;
    if ((orch?.repeatKey ?? 0) >= 2 && orch?.lastKey && orch.lastKey === nextKey) {
      alerts.push({
        id: `${t.id}-enqueue-loop`,
        severity: 'critical',
        target: t.id,
        code: 'enqueue_loop',
        message: `Repeated enqueue ${orch?.lastKey} (${orch?.repeatKey}x) � fix TRACK or clear queue`,
        count: orch?.repeatKey,
      });
    }

    const blockedSends = countRecent(
      lines,
      (l) => l.target === t.id && l.msg === 'send blocked',
      windowMs
    );
    if (blockedSends >= 8) {
      alerts.push({
        id: `${t.id}-send-blocked-warn`,
        severity: 'warn',
        target: t.id,
        code: 'send_blocked',
        message: `Expected send blocks ${blockedSends}x (loop-guard working)`,
        count: blockedSends,
      });
    }

    const noWindow = countRecent(
      lines,
      (l) => l.target === t.id && (l.msg === 'no window open' || !!l.err?.includes('no-window')),
      windowMs
    );
    if (noWindow >= 6) {
      alerts.push({
        id: `${t.id}-no-window`,
        severity: 'critical',
        target: t.id,
        code: 'no_window',
        message: `Composer ${t.id}: window not open (${noWindow}x) - open "${t.windowHint}" workspace`,
        count: noWindow,
      });
    } else if (noWindow >= 3) {
      alerts.push({
        id: `${t.id}-no-window-warn`,
        severity: 'warn',
        target: t.id,
        code: 'no_window',
        message: `Composer ${t.id}: window not open (${noWindow}x) - open "${t.windowHint}" workspace`,
        count: noWindow,
      });
    }

    const sendFail = countRecent(
      lines,
      (l) =>
        l.target === t.id &&
        l.msg === 'send failed' &&
        !isExpectedSendBlock(l.err),
      windowMs
    );
    if (sendFail >= 5) {
      const lastErr = [...lines].reverse().find((l) => l.target === t.id && l.msg === 'send failed')?.err;
      alerts.push({
        id: `${t.id}-send-fail`,
        severity: 'critical',
        target: t.id,
        code: 'send_fail_loop',
        message: `Send failed ${sendFail}x: ${lastErr ?? 'unknown'}`,
        count: sendFail,
      });
    }

    const sentSteps = lastSentSteps(lines, t.id);
    if (sentSteps.length >= 4 && sentSteps.every((s) => s === sentSteps[0])) {
      alerts.push({
        id: `${t.id}-step-stuck`,
        severity: 'critical',
        target: t.id,
        code: 'step_stuck',
        message: `Same nudge repeated: ${sentSteps[0]} - mark TRACK step done or fix guard`,
        count: sentSteps.length,
      });
    }

    const expected = fs.existsSync(t.agentDir) ? pickNextAgentStep(t.agentDir).step : null;
    const pending = trackPendingStep(t.agentDir);
    if (pending && expected && pending !== expected) {
      alerts.push({
        id: `${t.id}-track-drift`,
        severity: 'warn',
        target: t.id,
        code: 'track_drift',
        message: `TRACK pending ${pending} but pickNext says ${expected}`,
      });
    }
  }

  const usagePauses = countRecent(lines, (l) => l.msg === 'usage pause', windowMs);
  if (usagePauses >= 6) {
    alerts.push({
      id: 'usage-high',
      severity: 'warn',
      code: 'usage_pause',
      message: `Usage ring high ${usagePauses}x - reduce nudge frequency or wait for reset`,
      count: usagePauses,
    });
  }

  // Only count real runtime errors (with err field), not shell-level "tick failed" which
  // is just the loop's bash echo on non-zero exit and creates a self-blocking cycle.
  const realErrors = countRecent(lines, (l) => l.msg === 'error' && !!l.err, windowMs);
  if (realErrors >= 5) {
    alerts.push({
      id: 'guard-errors',
      severity: 'warn',
      code: 'guard_error',
      message: `Guard errors ${realErrors}x in last ${windowMs / 3600000}h`,
      count: realErrors,
    });
  }

  return { at: new Date().toISOString(), alerts, ok: alerts.length === 0 };
}
