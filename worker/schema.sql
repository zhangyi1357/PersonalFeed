-- Personal Feed items table
CREATE TABLE IF NOT EXISTS items (
  hn_id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  domain TEXT,
  by TEXT,
  hn_score INTEGER,
  descendants INTEGER,
  hn_time INTEGER,
  fetched_at TEXT,
  summary_short TEXT,
  summary_long TEXT,
  global_score REAL,
  tags TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  error_reason TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_date ON items(date);
CREATE INDEX IF NOT EXISTS idx_items_date_score ON items(date, global_score);
