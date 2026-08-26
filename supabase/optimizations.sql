-- ==========================================================
-- Supabase Performance & Optimization Tuning Script
-- ==========================================================

-- 1. Covering Composite Indexes for High-Frequency Queries
-- Speeds up leaderboard, recent history, and collection filtering

CREATE INDEX IF NOT EXISTS idx_users_leaderboard 
ON public.users (total_pulls DESC, global_rank ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_collection_lookup 
ON public.user_collection (osu_id, last_pulled_at DESC);

CREATE INDEX IF NOT EXISTS idx_history_user_recent 
ON public.user_history (osu_id, pulled_at DESC);

CREATE INDEX IF NOT EXISTS idx_collection_favorites 
ON public.user_collection (osu_id) WHERE is_favorite = true;

-- 2. Atomic Stored Procedure for Lightning-Fast Pull Sync
-- Executes all pull mutations (user total, collection upsert, history log) in 1 single ACID transaction!

CREATE OR REPLACE FUNCTION public.sync_pull_batch(
  p_osu_id BIGINT,
  p_total_pulls INT,
  p_pity_count INT,
  p_cards JSONB,
  p_history JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  card RECORD;
  hist RECORD;
BEGIN
  -- 1. Update user total stats
  UPDATE public.users
  SET 
    total_pulls = GREATEST(total_pulls, p_total_pulls),
    pity_count = p_pity_count,
    last_login = now()
  WHERE osu_id = p_osu_id;

  -- 2. Upsert collection items
  FOR card IN SELECT * FROM jsonb_to_recordset(p_cards) AS x(
    beatmap_id INT,
    copies INT,
    first_pulled_at BIGINT,
    last_pulled_at BIGINT,
    is_favorite BOOLEAN
  )
  LOOP
    INSERT INTO public.user_collection (osu_id, beatmap_id, copies, first_pulled_at, last_pulled_at, is_favorite)
    VALUES (p_osu_id, card.beatmap_id, COALESCE(card.copies, 1), card.first_pulled_at, card.last_pulled_at, COALESCE(card.is_favorite, false))
    ON CONFLICT (osu_id, beatmap_id) DO UPDATE SET
      copies = public.user_collection.copies + EXCLUDED.copies,
      last_pulled_at = EXCLUDED.last_pulled_at;
  END LOOP;

  -- 3. Insert history items
  FOR hist IN SELECT * FROM jsonb_to_recordset(p_history) AS y(
    id TEXT,
    beatmap_id INT,
    rarity TEXT,
    pulled_at BIGINT
  )
  LOOP
    INSERT INTO public.user_history (id, osu_id, beatmap_id, rarity, pulled_at)
    VALUES (hist.id, p_osu_id, hist.beatmap_id, hist.rarity, hist.pulled_at)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- 4. Prune history: keep latest 100 entries per user
  DELETE FROM public.user_history
  WHERE osu_id = p_osu_id
    AND id NOT IN (
      SELECT id FROM public.user_history
      WHERE osu_id = p_osu_id
      ORDER BY pulled_at DESC
      LIMIT 100
    );

  RETURN jsonb_build_object('success', true, 'osu_id', p_osu_id);
END;
$$;
