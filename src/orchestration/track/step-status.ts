import type { StepStatusKind } from './types';

/** Classify a TRACK table status cell (third column). */
export function classifyStepStatus(raw: string): StepStatusKind {
  const s = raw.trim().toLowerCase();
  if (s === 'skip') return 'skip';
  if (s === 'pending') return 'pending';
  if (/\bpending\b/.test(s)) return 'pending';
  if (s.startsWith('done')) return 'done';
  return 'done';
}

export function isStepOpen(status: StepStatusKind): boolean {
  return status === 'pending';
}

export function isStepClosed(status: StepStatusKind): boolean {
  return status === 'done' || status === 'skip';
}
