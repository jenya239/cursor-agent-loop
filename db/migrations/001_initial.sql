CREATE TABLE turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace TEXT NOT NULL,
  track TEXT,
  role TEXT NOT NULL,
  step TEXT,
  started_at TEXT,
  elapsed_minutes INTEGER,
  done TEXT,
  result TEXT,
  issues TEXT,
  next_prompt TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cost_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_token TEXT,
  composer_id TEXT,
  context_percent REAL,
  model TEXT,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agent_states (
  token TEXT PRIMARY KEY,
  composer_id TEXT,
  role TEXT,
  step TEXT,
  track TEXT,
  busy INTEGER NOT NULL DEFAULT 0,
  queue_length INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  topic TEXT NOT NULL,
  path TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT
);

CREATE INDEX idx_turns_workspace_created ON turns (workspace, created_at);
CREATE INDEX idx_cost_entries_created ON cost_entries (created_at);
CREATE INDEX idx_meetings_started ON meetings (started_at);
