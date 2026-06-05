import { openCrDatabase } from './migrate';

export type CostEntryRow = {
  id: number;
  agent_token: string | null;
  composer_id: string | null;
  context_percent: number | null;
  model: string | null;
  event_type: string;
  created_at: string;
};

export type RecordCostEntryInput = {
  agentToken?: string;
  composerId?: string;
  contextPercent?: number | null;
  model?: string | null;
  eventType?: string;
  databasePath?: string;
};

export function recordCostEntry(input: RecordCostEntryInput): CostEntryRow {
  const database = openCrDatabase(input.databasePath);
  try {
    const insert = database.prepare(`
      INSERT INTO cost_entries (agent_token, composer_id, context_percent, model, event_type)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = insert.run(
      input.agentToken ?? null,
      input.composerId ?? null,
      input.contextPercent ?? null,
      input.model ?? null,
      input.eventType ?? 'enqueue'
    );
    return database
      .prepare('SELECT * FROM cost_entries WHERE id = ?')
      .get(result.lastInsertRowid) as CostEntryRow;
  } finally {
    database.close();
  }
}

export function listCostEntries(options?: {
  limit?: number;
  databasePath?: string;
}): CostEntryRow[] {
  const limit = options?.limit ?? 100;
  const database = openCrDatabase(options?.databasePath);
  try {
    return database
      .prepare('SELECT * FROM cost_entries ORDER BY id DESC LIMIT ?')
      .all(limit) as CostEntryRow[];
  } finally {
    database.close();
  }
}
