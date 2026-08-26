-- Create an optimized PostgreSQL function to compute leaderboard metrics in 1 millisecond
CREATE OR REPLACE FUNCTION public.get_global_leaderboard()
RETURNS TABLE (
  osu_id BIGINT,
  username TEXT,
  avatar_url TEXT,
  country_code TEXT,
  global_rank INT,
  total_pulls INT,
  last_login TIMESTAMPTZ,
  unique_cards BIGINT,
  total_copies BIGINT,
  favorite_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    u.osu_id,
    u.username,
    u.avatar_url,
    u.country_code,
    u.global_rank,
    u.total_pulls,
    u.last_login,
    COALESCE(c.unique_count, 0) AS unique_cards,
    COALESCE(c.copies_sum, 0) AS total_copies,
    COALESCE(c.fav_count, 0) AS favorite_count
  FROM public.users u
  LEFT JOIN (
    SELECT 
      osu_id,
      COUNT(DISTINCT beatmap_id) AS unique_count,
      SUM(copies) AS copies_sum,
      COUNT(CASE WHEN is_favorite THEN 1 END) AS fav_count
    FROM public.user_collection
    GROUP BY osu_id
  ) c ON u.osu_id = c.osu_id
  WHERE u.is_banned = false
  ORDER BY u.total_pulls DESC;
$$;
