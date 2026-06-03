import fs from 'fs';
import os from 'os';
import path from 'path';
import { liveCdp } from '../cdp/live-cdp';
import { buildNudgePrompt, pickNextAgentStep } from '../cursor/agent_next';
import { AGENT_TARGETS, managedWindowTitle, resolveTargets, targetForComposer, type AgentTarget } from '../cursor/agent-targets';
import {
  analyzeSupervisor,
  guardBlockedAlerts,
  loadSupervisorReport,
  type SupervisorReport,
} from '../supervisor/analyze';
import { getAgentState, refreshAgentStates } from '../cursor/agent-state';
import { ChatStore } from '../chat-store';
import { CursorDbReader } from '../db/reader';
import { globalDbPath } from '../db/paths';
import type { ChatLine } from '../cursor/loop-guard';
import { maxUsagePct, probeWindowUsage } from '../cursor/probe-usage';
function overnightLogPath(): string {
  return process.env.CR_OVERNIGHT_LOG || path.join(os.homedir(), '.cursor', 'cr-overnight.log');
}

function overnightStatePath(): string {
  return path.join(path.dirname(overnightLogPath()), 'cr-overnight-state.json');
}

function parseTarget(raw: unknown): AgentTarget | null {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!s || s === 'all') return null;
  return AGENT_TARGETS.find((t) => t.id === s) ?? null;
}

export function mcpSupervisor(args: Record<string, unknown>): {
  report: SupervisorReport;
  blocked: ReturnType<typeof guardBlockedAlerts>;
} {
  const target = parseTarget(args.target) ?? targetForComposer(process.env.CR_AGENT_COMPOSER_ID?.trim() ?? '') ?? resolveTargets()[0];
  const refresh = args.refresh === true || args.refresh === 'true';
  const report = refresh
    ? analyzeSupervisor({ logPath: overnightLogPath(), targets: resolveTargets(typeof args.target === 'string' ? args.target : undefined) })
    : loadSupervisorReport() ?? analyzeSupervisor({ logPath: overnightLogPath(), targets: resolveTargets(typeof args.target === 'string' ? args.target : undefined) });
  const blocked = guardBlockedAlerts(report, target?.id);
  return { report, blocked };
}

function agentNextRow(t: AgentTarget, token: string, includePrompt: boolean): Record<string, unknown> {
  const next = pickNextAgentStep(t.agentDir);
  const row: Record<string, unknown> = {
    target: t.id,
    composerId: t.composerId,
    agentDir: t.agentDir,
    next,
  };
  if (includePrompt && token) {
    row.prompt = buildNudgePrompt(next, token, t.id);
  }
  return row;
}

export function mcpAgentNext(args: Record<string, unknown>): Record<string, unknown> {
  const token = typeof args.token === 'string' ? args.token.trim() : '';
  const includePrompt = args.includePrompt === true || args.includePrompt === 'true';
  const one = parseTarget(args.target);
  if (one) return agentNextRow(one, token, includePrompt);
  if (typeof args.target === 'string' && args.target.trim().toLowerCase() === 'all') {
    return { targets: AGENT_TARGETS.map((t) => agentNextRow(t, token, includePrompt)) };
  }
  const composerId = typeof args.composerId === 'string' ? args.composerId.trim() : '';
  const byComposer = composerId ? targetForComposer(composerId) : null;
  const t = byComposer ?? resolveTargets()[0];
  return agentNextRow(t, token, includePrompt);
}

export async function mcpUsage(): Promise<Record<string, unknown>> {
  const windows = await probeWindowUsage(liveCdp);
  return { maxUsagePct: maxUsagePct(windows), windows };
}

export async function mcpAgentState(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const target = parseTarget(args.target);
  const refresh = args.refresh === true || args.refresh === 'true';
  if (refresh) {
    const usageWindows = await probeWindowUsage(liveCdp);
    const dbPath = process.env.CURSOR_DB || globalDbPath();
    const reader = CursorDbReader.fromPath(dbPath);
    const store = new ChatStore(reader, dbPath, false);
    try {
      const targets = target ? [target] : resolveTargets();
      const messages = new Map<string, ChatLine[]>();
      for (const t of targets) {
        messages.set(t.composerId, store.getChat(t.composerId, true).messages);
      }
      refreshAgentStates(targets, messages, usageWindows);
    } finally {
      reader.close();
    }
  }
  return getAgentState(target?.id);
}

export function mcpOvernightState(args: Record<string, unknown>): Record<string, unknown> {
  const tail = Math.min(Number(args.tail) || 20, 100);
  const statePath = overnightStatePath();
  const logPath = overnightLogPath();
  let state: unknown = null;
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    /* missing */
  }
  let logTail: string[] = [];
  if (fs.existsSync(logPath)) {
    logTail = fs
      .readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .slice(-tail);
  }
  return { statePath, state, logPath, logTail };
}
