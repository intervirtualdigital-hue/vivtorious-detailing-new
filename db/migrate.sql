-- Victorious schema

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  page TEXT,
  vehicle_type TEXT,
  package_name TEXT,
  price_total INTEGER,
  city TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  consent TEXT,
  referrer TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts);

CREATE TABLE IF NOT EXISTS pricing (
  package_key TEXT NOT NULL,
  vehicle_key TEXT NOT NULL,
  current_price INTEGER NOT NULL,
  regular_price INTEGER NOT NULL,
  duration TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (package_key, vehicle_key)
);

CREATE TABLE IF NOT EXISTS pricing_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_key TEXT NOT NULL,
  vehicle_key TEXT NOT NULL,
  old_current_price INTEGER,
  new_current_price INTEGER,
  old_regular_price INTEGER,
  new_regular_price INTEGER,
  changed_at TEXT NOT NULL,
  changed_by TEXT
);

CREATE TABLE IF NOT EXISTS city_pages (
  slug TEXT PRIMARY KEY,
  city_name TEXT NOT NULL,
  county TEXT,
  meta_title TEXT,
  meta_description TEXT,
  h1 TEXT,
  intro_copy TEXT,
  why_choose_copy TEXT,
  nearby_slugs TEXT,
  lat REAL,
  lng REAL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_city_pages_active ON city_pages(active);
