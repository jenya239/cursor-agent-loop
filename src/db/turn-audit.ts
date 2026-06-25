import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { openCrDatabase } from './migrate';

export type TurnAuditRow = {
  id: number;
  workspace: string;
  line_hash: string;
  ts: string;
  event: string;
  role: string | null;
  step: string | null;
  track: string | null;
  target: string | null;
  token: string | null;
  why: string | null;
  prompt_key: string | null;
  db_status: string | null;
  page_title: string | null;
  model: string | null;
  usage_pct: number | null;
  created_at: string;
};

export type TurnAuditInsert = {
  workspace: string;
  lineHash: string;
  ts: string;
  event: string;
  role?: string | null;
  step?: string | null;
  track?: string | null;
  target?: string | null;
  token?: string | null;
  why?: string | null;
  promptKey?: string | null;
  dbStatus?: string | null;
  pageTitle?: string | null;
  model?: string | null;
  usagePct?: number | null;
};

export function hashTurnLogLine(line: string): string {
  return crypto.createHash('sha256').update(line.trim()).digest('hex').slice(0, 32);
}

function insertStmt(database: Database.Database) {
  return database.prepare(`
    INSERT OR IGNORE INTO turn_audit_events (
      workspace, line_hash, ts, event, role, step, track, target, token,
      why, prompt_key, db_status, page_title, model, usage_pct
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
}

export function insertTurnAuditEvents(
  rows: TurnAuditInsert[],
  databasePath?: string
): number {
  if (!rows.length) return 0;
  const database = openCrDatabase(databasePath);
  try {
    const insert = insertStmt(database);
    const tx = database.transaction((items: TurnAuditInsert[]) => {
      let added = 0;
      for (const row of items) {
        const info = insert.run(
          row.workspace,
          row.lineHash,
          row.ts,
          row.event,
          row.role ?? null,
          row.step ?? null,
          row.track ?? null,
          row.target ?? null,
          row.token ?? null,
          row.why ?? null,
          row.promptKey ?? null,
          row.dbStatus ?? null,
          row.pageTitle ?? null,
          row.model ?? null,
          row.usagePct ?? null
        );
        added += info.changes;
      }
      return added;
    });
    return tx(rows);
  } finally {
    database.close();
  }
}

export function listTurnAuditEvents(options: {
  workspace: string;
  limit?: number;
  databasePath?: string;
}): TurnAuditRow[] {
  const limit = options.limit ?? 50;
  const database = openCrDatabase(options.databasePath);
  try {
    return database
      .prepare(
        `SELECT * FROM turn_audit_events
         WHERE workspace = ?
         ORDER BY ts DESC, id DESC
         LIMIT ?`
      )
      .all(options.workspace, limit) as TurnAuditRow[];
  } finally {
    database.close();
  }
}
