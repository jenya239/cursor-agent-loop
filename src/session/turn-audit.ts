import fs from 'fs';
import path from 'path';

export type TurnAuditEvent = {
  ts: string;
  event: 'sent' | 'turn_done' | 'turn_aborted' | 'guard_skip' | 'recovery';
  role?: string;
  step?: string;
  track?: string;
  target?: string;
  token?: string;
  why?: string;
  prompt_key?: string;
  db_status?: string;
  page_title?: string;
  model?: string;
  usage_pct?: number | null;
};

export function turnLogPath(agentDir: string): string {
  return path.join(agentDir, 'TURNLOG.jsonl');
}

/** Append-only audit log (git-tracked). Guard writes; agent enriches via SESSION. */
export function appendTurnAudit(agentDir: string, event: TurnAuditEvent): void {
  const file = turnLogPath(agentDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(event) + '\n', 'utf8');
}
