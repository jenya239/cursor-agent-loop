import { openCrDatabase } from './migrate';

export type AgentStateRow = {
  token: string;
  composer_id: string | null;
  role: string | null;
  step: string | null;
  track: string | null;
  busy: number;
  queue_length: number;
  updated_at: string;
};

export type UpsertAgentStateInput = {
  token: string;
  composerId?: string;
  role?: string;
  step?: string;
  track?: string;
  busy?: number;
  queueLength?: number;
  databasePath?: string;
};

export function upsertAgentState(input: UpsertAgentStateInput): AgentStateRow {
  const database = openCrDatabase(input.databasePath);
  try {
    database
      .prepare(
        `
        INSERT INTO agent_states (token, composer_id, role, step, track, busy, queue_length)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(token) DO UPDATE SET
          composer_id = excluded.composer_id,
          role = excluded.role,
          step = COALESCE(excluded.step, agent_states.step),
          track = COALESCE(excluded.track, agent_states.track),
          busy = excluded.busy,
          queue_length = excluded.queue_length,
          updated_at = datetime('now')
      `
      )
      .run(
        input.token,
        input.composerId ?? null,
        input.role ?? null,
        input.step ?? null,
        input.track ?? null,
        input.busy ?? 0,
        input.queueLength ?? 0
      );
    return database
      .prepare('SELECT * FROM agent_states WHERE token = ?')
      .get(input.token) as AgentStateRow;
  } finally {
    database.close();
  }
}

export function getAgentStateByToken(
  token: string,
  databasePath?: string
): AgentStateRow | null {
  const database = openCrDatabase(databasePath);
  try {
    const row = database
      .prepare('SELECT * FROM agent_states WHERE token = ?')
      .get(token) as AgentStateRow | undefined;
    return row ?? null;
  } finally {
    database.close();
  }
}
