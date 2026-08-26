-- ==========================================================
-- osu! Beatmap Gacha - Supabase PostgreSQL Database Schema
-- ==========================================================

-- 1. Users Table (keyed by osu! Account ID)
CREATE TABLE IF NOT EXISTS public.users (
  osu_id BIGINT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_url TEXT,
  country_code TEXT,
  global_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_login TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  total_pulls INTEGER DEFAULT 0 NOT NULL,
  pity_count INTEGER DEFAULT 0 NOT NULL,
  is_banned BOOLEAN DEFAULT false NOT NULL
);

-- 2. User Sessions Table (30-day authentication tokens)
CREATE TABLE IF NOT EXISTS public.user_sessions (
  token TEXT PRIMARY KEY,
  osu_id BIGINT NOT NULL REFERENCES public.users(osu_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- 3. User Beatmap Collection Table (synchronized across all devices)
CREATE TABLE IF NOT EXISTS public.user_collection (
  osu_id BIGINT NOT NULL REFERENCES public.users(osu_id) ON DELETE CASCADE,
  beatmap_id INTEGER NOT NULL,
  copies INTEGER DEFAULT 1 NOT NULL,
  first_pulled_at BIGINT NOT NULL,
  last_pulled_at BIGINT NOT NULL,
  is_favorite BOOLEAN DEFAULT false NOT NULL,
  PRIMARY KEY (osu_id, beatmap_id)
);

-- 4. User Pull History Table (recent pulls archive)
CREATE TABLE IF NOT EXISTS public.user_history (
  id TEXT PRIMARY KEY,
  osu_id BIGINT NOT NULL REFERENCES public.users(osu_id) ON DELETE CASCADE,
  beatmap_id INTEGER NOT NULL,
  rarity TEXT NOT NULL,
  pulled_at BIGINT NOT NULL
);

-- 5. Admin Config Table (global rate/stamina overrides & maintenance flags)
CREATE TABLE IF NOT EXISTS public.admin_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Per-user energy override signals (set by admin, consumed on next sync)
CREATE TABLE IF NOT EXISTS public.user_energy_overrides (
  osu_id BIGINT PRIMARY KEY REFERENCES public.users(osu_id) ON DELETE CASCADE,
  energy_amount INTEGER NOT NULL DEFAULT 50,
  set_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON public.user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_collection_user ON public.user_collection(osu_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON public.user_history(osu_id, pulled_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_pulls ON public.users(total_pulls DESC);
CREATE INDEX IF NOT EXISTS idx_users_login ON public.users(last_login DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_energy_overrides ENABLE ROW LEVEL SECURITY;

-- Public RLS Read/Write Policies (Permissive for Client + Worker authentication)
CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow service all users" ON public.users FOR ALL USING (true);

CREATE POLICY "Allow service all sessions" ON public.user_sessions FOR ALL USING (true);
CREATE POLICY "Allow service all collection" ON public.user_collection FOR ALL USING (true);
CREATE POLICY "Allow service all history" ON public.user_history FOR ALL USING (true);
CREATE POLICY "Allow service all config" ON public.admin_config FOR ALL USING (true);
CREATE POLICY "Allow service all overrides" ON public.user_energy_overrides FOR ALL USING (true);
