import path from 'path';

export interface AgentTarget {
  id: 'mlc' | 'cr';
  composerId: string;
  agentDir: string;
  windowHint: string;
  fastOnly: boolean;
}

const REPO = path.join(__dirname, '../..');

export const AGENT_TARGETS: AgentTarget[] = [
  {
    id: 'mlc',
    composerId: process.env.CR_MLC_COMPOSER_ID || 'f8e0a645-1610-4a1e-b19f-63f502235a2e',
    agentDir: process.env.MLC_AGENT_DIR || path.join(REPO, '../mlc/docs/agent'),
    windowHint: 'mlc',
    fastOnly: true,
  },
  {
    id: 'cr',
    composerId: process.env.CR_SELF_COMPOSER_ID || '90b0b877-3af6-4ab7-91ae-4d259b3e6e21',
    agentDir: process.env.CR_AGENT_DIR || path.join(REPO, 'docs/agent'),
    windowHint: 'cr',
    fastOnly: true,
  },
];

export function targetForComposer(composerId: string): AgentTarget | null {
  return AGENT_TARGETS.find((t) => t.composerId === composerId) ?? null;
}

export function isManagedComposer(composerId: string | undefined): boolean {
  if (!composerId) return false;
  return AGENT_TARGETS.some((t) => t.composerId === composerId);
}

/** Managed agent windows only (mlc/cr). Other Cursor projects are ignored. */
export function managedWindowTitle(windowTitle: string, composerId?: string): boolean {
  if (composerId && isManagedComposer(composerId)) return true;
  const low = windowTitle.toLowerCase();
  return AGENT_TARGETS.some((t) => low.includes(t.windowHint.toLowerCase()));
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
