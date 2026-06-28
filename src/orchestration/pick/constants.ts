import type { TrackFocus } from '../track/types';

export const INSTRUCTIONS_REV = '2026-05-28-cleaner';

export const FOCUS_ORDER: TrackFocus[] = [
  'stability',
  'security',
  'performance',
  'architecture',
  'tooling',
];

export function isCrAgentDir(agentDir: string): boolean {
  return agentDir.replace(/\\/g, '/').includes('/cr/docs/agent');
}

export function sortByFocus<T extends { focus: TrackFocus }>(items: T[]): T[] {
  return [...items].sort((a, b) => FOCUS_ORDER.indexOf(a.focus) - FOCUS_ORDER.indexOf(b.focus));
}
