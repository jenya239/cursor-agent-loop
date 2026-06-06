import type { SessionTurn } from '../progress/report';
import { openCrDatabase } from './migrate';

export type TurnRow = {
  id: number;
  workspace: string;
  track: string | null;
  role: string;
  step: string | null;
  started_at: string | null;
  elapsed_minutes: number | null;
  done: string | null;
  result: string | null;
  issues: string | null;
  next_prompt: string | null;
  created_at: string;
};

export type SessionTurnRecord = {
  workspace: string;
  track?: string | null;
  role: string;
  step?: string | null;
  startedAt?: string | null;
  done?: string | null;
  result?: string | null;
};

function trackFromTitle(title: string): string | null {
  const match = title.match(/TRACK_[A-Z0-9_]+/);
  return match?.[0] ?? null;
}

export function sessionTurnToRecord(workspace: string, turn: SessionTurn): SessionTurnRecord {
  return {
    workspace,
    track: trackFromTitle(turn.title),
    role: turn.role,
    step: turn.step || null,
    startedAt: turn.date || null,
    done: turn.done || null,
    result: turn.gate || null,
  };
}

export function replaceWorkspaceTurns(
  workspace: string,
  turns: SessionTurnRecord[],
  databasePath?: string
): number {
  const database = openCrDatabase(databasePath);
  try {
    const remove = database.prepare('DELETE FROM turns WHERE workspace = ?');
    const insert = database.prepare(`
      INSERT INTO turns (workspace, track, role, step, started_at, done, result)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const transaction = database.transaction((rows: SessionTurnRecord[]) => {
      remove.run(workspace);
      for (const row of rows) {
        insert.run(
          row.workspace,
          row.track ?? null,
          row.role,
          row.step ?? null,
          row.startedAt ?? null,
          row.done ?? null,
          row.result ?? null
        );
      }
      return rows.length;
    });
    return transaction(turns);
  } finally {
    database.close();
  }
}

export function listWorkspaceTurns(options: {
  workspace: string;
  limit?: number;
  databasePath?: string;
}): TurnRow[] {
  const limit = options.limit ?? 25;
  const database = openCrDatabase(options.databasePath);
  try {
    return database
      .prepare(
        'SELECT * FROM turns WHERE workspace = ? ORDER BY id ASC LIMIT ?'
      )
      .all(options.workspace, limit) as TurnRow[];
  } finally {
    database.close();
  }
}

export function turnRowsToSessionTurns(rows: TurnRow[]): SessionTurn[] {
  return rows.map((row) => ({
    date: row.started_at ?? '',
    title: row.track ? `Turn (${row.role} ${row.track} step ${row.step ?? ''})` : `Turn (${row.role})`,
    role: row.role,
    step: row.step ?? '',
    done: row.done ?? '',
    gate: row.result ?? '',
  }));
}

export function listSessionTurnsFromDatabase(options: {
  workspace: string;
  limit?: number;
  databasePath?: string;
}): SessionTurn[] {
  return turnRowsToSessionTurns(listWorkspaceTurns(options));
}
