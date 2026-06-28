import type { TrackContent, TrackFocus, TrackRow } from './types';
import { classifyStepStatus, isStepOpen } from './step-status';

const FOCUS_BY_NAME: Record<string, TrackFocus> = {
  TRACK_PHASE1: 'stability',
  TRACK_ORCH: 'stability',
  TRACK_CPPEXPR: 'architecture',
  TRACK_CPPGEN: 'architecture',
  TRACK_PLAN: 'architecture',
  TRACK_DIAGNOSTICS2: 'stability',
};

const STEP_TABLE_ROW = /^\|\s*(\d+)\s*\|([^|\n]*)\|\s*([^|\n]+?)\s*\|$/gm;

export function trackFocus(name: string, content: string): TrackFocus {
  if (FOCUS_BY_NAME[name]) return FOCUS_BY_NAME[name];
  if (/crash|fuzz|safety|security/i.test(content)) return 'security';
  if (/perf|benchmark|speed|optim/i.test(content)) return 'performance';
  return 'stability';
}

export function parseStepTable(content: string): TrackRow[] {
  const rows: TrackRow[] = [];
  for (const m of content.matchAll(STEP_TABLE_ROW)) {
    rows.push({ step: Number(m[1]), item: m[2].trim(), status: m[3].trim() });
  }
  return rows;
}

export function parseTrackClosed(content: string): { closed: boolean; closedAt?: string } {
  const closed = /## Status:\s*\*\*closed\*\*|Status:\s*closed/i.test(content);
  if (!closed) return { closed: false };
  const m = content.match(/## Status:\s*\*\*closed\*\*[^(\n]*\([^)]*?(\d{4}-\d{2}-\d{2})/);
  return { closed: true, closedAt: m?.[1] };
}

export function parseTrackInProgress(content: string, closed: boolean): boolean {
  if (closed) return false;
  return (
    /in progress/i.test(content) ||
    /\*\*Status:\*\*\s*\*\*open\*\*/i.test(content) ||
    /Status:\s*\*\*(active|open)\*\*/i.test(content) ||
    /Status:\s*\*\*(active|open)/i.test(content) ||
    /Status:\s*(active|open)/i.test(content)
  );
}

export function pendingStepsFromRows(rows: TrackRow[]): { pending: number[]; meta: Set<number> } {
  const pending: number[] = [];
  const meta = new Set<number>();
  for (const row of rows) {
    if (!isStepOpen(classifyStepStatus(row.status))) continue;
    pending.push(row.step);
    if (/meta-review|meta review/i.test(row.item)) meta.add(row.step);
  }
  pending.sort((a, b) => a - b);
  return { pending, meta };
}

/** Open track with empty pending table � infer from header STEP=N. */
export function inferPendingFromHeader(content: string, rows: TrackRow[]): number[] {
  const header =
    content.match(/\*\*STEP=(\d+)/)?.[1] ?? content.match(/Status:[^\n]*STEP=(\d+)/i)?.[1];
  if (!header) return [];
  if (!/Status:[^\n]*\bopen\b/i.test(content) && !/in progress/i.test(content)) return [];
  const n = Number(header);
  const row = rows.find((r) => r.step === n);
  if (!row) return [n];
  if (isStepOpen(classifyStepStatus(row.status))) return [n];
  return [];
}

export function reconcilePendingSteps(
  content: string,
  rows: TrackRow[],
  inProgress: boolean,
  closed: boolean
): { pending: number[]; meta: Set<number> } {
  const fromTable = pendingStepsFromRows(rows);
  if (fromTable.pending.length || closed || !inProgress) return fromTable;
  const inferred = inferPendingFromHeader(content, rows);
  if (!inferred.length) return fromTable;
  return { pending: inferred, meta: fromTable.meta };
}

export function parseTrackContent(name: string, content: string): TrackContent {
  const { closed, closedAt } = parseTrackClosed(content);
  const inProgress = parseTrackInProgress(content, closed);
  const rows = parseStepTable(content);
  const { pending, meta } = reconcilePendingSteps(content, rows, inProgress, closed);
  const nextMatch = content.match(/\*\*STEP=(\d+)\*\*/);
  const nextStep = nextMatch ? Number(nextMatch[1]) : pending[0];
  const prevMatch = content.match(/previous:\s*\[?(TRACK_\w+\.md)\]?/i);
  const hasBlockedSkip = /skip\s*[��-]\s*blocker:/i.test(content);

  return {
    name,
    closed,
    closedAt,
    inProgress,
    rows,
    pendingSteps: pending,
    pendingMeta: meta,
    nextStep,
    previousFile: prevMatch?.[1],
    hasBlockedSkip,
    focus: trackFocus(name, content),
  };
}

export function stepStatusInContent(content: string, step: string): 'pending' | 'done' | 'unknown' {
  if (!/^\d+$/.test(step)) return 'unknown';
  const row = parseStepTable(content).find((r) => r.step === Number(step));
  if (!row) return 'unknown';
  const kind = classifyStepStatus(row.status);
  return kind === 'pending' ? 'pending' : 'done';
}
