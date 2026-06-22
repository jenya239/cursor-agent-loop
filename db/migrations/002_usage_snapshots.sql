CREATE TABLE IF NOT EXISTS usage_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,            -- YYYY-MM-DD UTC
  plan        TEXT,
  auto_composer_pct REAL,
  api_pct     REAL,
  on_demand_usd     REAL,
  on_demand_limit_usd REAL,
  resets_in   TEXT,
  raw_text    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_snapshots_date ON usage_snapshots (date);
