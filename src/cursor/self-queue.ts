/**
 * Self-queue: lets the agent insert tasks for itself.
 *
 * File: docs/agent/SELF_QUEUE.md  (inside agentDir)
 * Format (one pending item per line):
 *   - [ ] ROLE=Driver STEP=fix-parse-bug TRACK=TRACK_FOO.md REASON=parse error in record_lit_merge.mlc
 *   - [x] ... (done � guard ignores)
 *
 * Guard reads this before pickNextAgentStep.
 * After the step completes (turn_done with matching key), guard marks the line [x].
 */

import fs from 'fs';
import path from 'path';
import type { NextAgentStep } from './agent_next';

const SELF_QUEUE_FILE = 'SELF_QUEUE.md';

export interface SelfQueueItem {
  role: string;
  step: string;
  trackFile?: string;
  reason: string;
  refs: string[];
  raw: string;
  lineIndex: number;
}

function parseLine(line: string, lineIndex: number): SelfQueueItem | null {
  // must be pending: "- [ ] ..."
  if (!/^- \[ \]/.test(line)) return null;
  const body = line.replace(/^- \[ \]\s*/, '');

  const role = body.match(/ROLE=(\S+)/)?.[1] ?? 'Driver';
  const step = body.match(/STEP=(\S+)/)?.[1];
  if (!step) return null;
  const trackFile = body.match(/TRACK=(\S+)/)?.[1];
  const reason = body.match(/REASON=(.+)/)?.[1]?.trim() ?? 'self-queued task';

  const refs: string[] = [];
  if (trackFile) refs.push(`@docs/agent/${trackFile}`);
  refs.push('@docs/agent/CONTINUITY.md');

  return { role, step, trackFile: trackFile ?? '', reason, refs, raw: line, lineIndex };
}

export function readSelfQueue(agentDir: string): SelfQueueItem[] {
  const file = path.join(agentDir, SELF_QUEUE_FILE);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line, i) => parseLine(line, i))
    .filter((x): x is SelfQueueItem => x !== null);
}

export function peekSelfQueue(agentDir: string): NextAgentStep | null {
  const items = readSelfQueue(agentDir);
  if (!items.length) return null;
  const item = items[0];
  return {
    role: item.role as NextAgentStep['role'],
    step: item.step,
    trackFile: item.trackFile ?? 'TRACK_PLAN.md',
    focus: 'stability',
    reason: `[self-queued] ${item.reason}`,
    refs: item.refs,
  };
}

/** Mark the first matching pending item as done [x]. */
export function completeSelfQueueItem(agentDir: string, step: string): boolean {
  const file = path.join(agentDir, SELF_QUEUE_FILE);
  if (!fs.existsSync(file)) return false;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let changed = false;
  const updated = lines.map((line) => {
    if (!changed && /^- \[ \]/.test(line) && line.includes(`STEP=${step}`)) {
      changed = true;
      return line.replace('- [ ]', '- [x]');
    }
    return line;
  });
  if (changed) fs.writeFileSync(file, updated.join('\n'));
  return changed;
}

/** Append a new pending item to the queue (agent calls this via MCP or directly). */
export function appendSelfQueueItem(
  agentDir: string,
  item: { role?: string; step: string; track?: string; reason: string }
): void {
  const file = path.join(agentDir, SELF_QUEUE_FILE);
  const role = item.role ?? 'Driver';
  const parts = [`ROLE=${role}`, `STEP=${item.step}`];
  if (item.track) parts.push(`TRACK=${item.track}`);
  parts.push(`REASON=${item.reason}`);
  const line = `- [ ] ${parts.join(' ')}`;
  const header = fs.existsSync(file)
    ? ''
    : '# Self-Queue\n\nTasks enqueued by the agent during a step.\n\n';
  fs.appendFileSync(file, header + line + '\n');
}
