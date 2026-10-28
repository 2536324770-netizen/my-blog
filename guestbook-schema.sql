CREATE TABLE IF NOT EXISTS guestbook (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS guestbook_created_at ON guestbook (created_at DESC);

CREATE TABLE IF NOT EXISTS guestbook_rate_limits (
  client_key TEXT PRIMARY KEY,
  last_post INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS guestbook_admin_attempts (
  client_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS site_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
