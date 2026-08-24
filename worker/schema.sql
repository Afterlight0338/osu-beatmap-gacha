-- ==========================================================
-- osu! Beatmap Gacha Cloudflare D1 SQL Database Schema
-- ==========================================================

-- 1. Users Table (keyed by osu! Account ID)
CREATE TABLE IF NOT EXISTS users (
  osu_id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_url TEXT,
  country_code TEXT,
  global_rank INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_pulls INTEGER DEFAULT 0,
  pity_count INTEGER DEFAULT 0
);

-- 2. User Sessions Table (30-day authentication tokens)
CREATE TABLE IF NOT EXISTS user_sessions (
  token TEXT PRIMARY KEY,
  osu_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (osu_id) REFERENCES users(osu_id) ON DELETE CASCADE
);

-- 3. User Beatmap Collection Table (synchronized across all devices)
CREATE TABLE IF NOT EXISTS user_collection (
  osu_id INTEGER NOT NULL,
  beatmap_id INTEGER NOT NULL,
  copies INTEGER DEFAULT 1,
  first_pulled_at INTEGER NOT NULL,
  last_pulled_at INTEGER NOT NULL,
  is_favorite INTEGER DEFAULT 0,
  PRIMARY KEY (osu_id, beatmap_id),
  FOREIGN KEY (osu_id) REFERENCES users(osu_id) ON DELETE CASCADE
);

-- 4. User Pull History Table (recent pulls archive)
CREATE TABLE IF NOT EXISTS user_history (
  id TEXT PRIMARY KEY,
  osu_id INTEGER NOT NULL,
  beatmap_id INTEGER NOT NULL,
  rarity TEXT NOT NULL,
  pulled_at INTEGER NOT NULL,
  FOREIGN KEY (osu_id) REFERENCES users(osu_id) ON DELETE CASCADE
);

-- Indexes for blazing fast lookups
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_collection_user ON user_collection(osu_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON user_history(osu_id, pulled_at DESC);
