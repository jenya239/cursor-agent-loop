CREATE TABLE turn_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace TEXT NOT NULL,
  line_hash TEXT NOT NULL,
  ts TEXT NOT NULL,
  event TEXT NOT NULL,
  role TEXT,
  step TEXT,
  track TEXT,
  target TEXT,
  token TEXT,
  why TEXT,
  prompt_key TEXT,
  db_status TEXT,
  page_title TEXT,
  model TEXT,
  usage_pct REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (workspace, line_hash)
);

CREATE INDEX idx_turn_audit_workspace_ts ON turn_audit_events (workspace, ts DESC);
CREATE INDEX idx_turn_audit_prompt ON turn_audit_events (workspace, prompt_key, event);
