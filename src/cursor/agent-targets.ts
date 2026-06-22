import path from 'path';
import type { WindowObservation } from '../watchdog/window-observation';

export type AgentTransport = 'cdp' | 'tmux';

export interface AgentTarget {
  id: 'mlc' | 'cr';
  transport: AgentTransport;
  composerId: string;
  paneId?: string;
  agentDir: string;
  windowHint: string;
  fastOnly: boolean;
  /** Skip send if model contains "fast" — enforce standard model usage */
  standardOnly: boolean;
}

function transportForTarget(targetId: 'mlc' | 'cr'): AgentTransport {
  const environmentKey = targetId === 'mlc' ? 'CR_MLC_TRANSPORT' : 'CR_CR_TRANSPORT';
  const value = process.env[environmentKey]?.trim().toLowerCase();
  if (value === 'tmux') return 'tmux';
  return 'cdp';
}

function paneIdForTarget(targetId: 'mlc' | 'cr'): string | undefined {
  const environmentKey = targetId === 'mlc' ? 'CR_MLC_TMUX_PANE' : 'CR_CR_TMUX_PANE';
  const value = process.env[environmentKey]?.trim();
  return value || undefined;
}

export function tmuxWindowTitle(targetId: string): string {
  return `tmux:${targetId}`;
}

const REPO = path.join(__dirname, '../..');

export const AGENT_TARGETS: AgentTarget[] = [
  {
    id: 'mlc',
    transport: transportForTarget('mlc'),
    composerId: process.env.CR_MLC_COMPOSER_ID || 'f8e0a645-1610-4a1e-b19f-63f502235a2e',
    paneId: paneIdForTarget('mlc'),
    agentDir: process.env.MLC_AGENT_DIR || path.join(REPO, '../mlc/docs/agent'),
    windowHint: 'mlc',
    fastOnly: false,
    standardOnly: true,
  },
  {
    id: 'cr',
    transport: transportForTarget('cr'),
    composerId: process.env.CR_SELF_COMPOSER_ID || '90b0b877-3af6-4ab7-91ae-4d259b3e6e21',
    paneId: paneIdForTarget('cr'),
    agentDir: process.env.CR_AGENT_DIR || path.join(REPO, 'docs/agent'),
    windowHint: 'cr',
    fastOnly: true,
    standardOnly: false,
  },
];

export function cdpAgentTargets(): AgentTarget[] {
  return AGENT_TARGETS.filter((target) => target.transport === 'cdp');
}

export function tmuxAgentTargets(): AgentTarget[] {
  return AGENT_TARGETS.filter((target) => target.transport === 'tmux' && target.paneId);
}

export function targetForComposer(composerId: string): AgentTarget | null {
  return AGENT_TARGETS.find((t) => t.composerId === composerId) ?? null;
}

export function isManagedComposer(composerId: string | undefined): boolean {
  if (!composerId) return false;
  return AGENT_TARGETS.some((t) => t.composerId === composerId);
}

/** Managed agent windows only (mlc/cr). Other Cursor projects are ignored. */
export function managedWindowTitle(windowTitle: string, composerId?: string): boolean {
  if (windowTitle.startsWith('tmux:')) {
    const targetId = windowTitle.slice('tmux:'.length);
    return AGENT_TARGETS.some((target) => target.id === targetId);
  }
  if (composerId && isManagedComposer(composerId)) return true;
  const low = windowTitle.toLowerCase();
  return AGENT_TARGETS.some((t) => low.includes(t.windowHint.toLowerCase()));
}

export function isManagedObservation(window: WindowObservation): boolean {
  return managedWindowTitle(window.windowTitle, window.composerId);
}

/** One agent unless CR_GUARD_TARGET=all or explicit id. Never nudge both by default. */
export function resolveTargets(spec?: string): AgentTarget[] {
  const s = (spec ?? process.env.CR_GUARD_TARGET ?? '').trim().toLowerCase();
  if (s === 'all') return AGENT_TARGETS;
  if (s) {
    const one = AGENT_TARGETS.find((t) => t.id === s);
    if (!one) throw new Error(`unknown CR_GUARD_TARGET: ${s}`);
    return [one];
  }
  const cid = process.env.CR_AGENT_COMPOSER_ID?.trim();
  if (cid) {
    const hit = targetForComposer(cid);
    if (hit) return [hit];
  }
  return [AGENT_TARGETS.find((t) => t.id === 'cr')!];
}
