import { Beatmap } from '../types/beatmap';

export interface BeatmapDifficultyStats {
  cs: number;
  ar: number;
  od: number;
  hp: number;
  isExact?: boolean;
}

const statsCache: Map<number, BeatmapDifficultyStats> = new Map();
const pendingFetches: Set<number> = new Set();

/**
 * Calculates standard difficulty settings (AR, CS, HP, OD) based on osu! standard star rating guidelines.
 */
export function estimateBeatmapStats(stars: number): BeatmapDifficultyStats {
  const s = Math.max(1, stars);

  let ar = 8.0;
  let cs = 4.0;
  let od = 8.0;
  let hp = 5.5;

  if (s >= 8.0) {
    ar = Math.min(10.0, +(9.4 + (s - 8.0) * 0.25).toFixed(1));
    cs = +(4.0 + (s >= 8.5 ? 0.2 : 0)).toFixed(1);
    od = Math.min(10.0, +(9.2 + (s - 8.0) * 0.3).toFixed(1));
    hp = Math.min(8.5, +(6.2 + (s - 8.0) * 0.3).toFixed(1));
  } else if (s >= 6.5) {
    ar = +(9.2 + (s - 6.5) * 0.13).toFixed(1);
    cs = 4.0;
    od = +(8.8 + (s - 6.5) * 0.26).toFixed(1);
    hp = +(5.8 + (s - 6.5) * 0.26).toFixed(1);
  } else if (s >= 5.3) {
    ar = +(9.0 + (s - 5.3) * 0.16).toFixed(1);
    cs = 4.0;
    od = +(8.0 + (s - 5.3) * 0.66).toFixed(1);
    hp = +(5.3 + (s - 5.3) * 0.41).toFixed(1);
  } else if (s >= 4.0) {
    ar = +(8.0 + (s - 4.0) * 0.76).toFixed(1);
    cs = 4.0;
    od = +(6.5 + (s - 4.0) * 1.15).toFixed(1);
    hp = +(4.5 + (s - 4.0) * 0.61).toFixed(1);
  } else {
    ar = Math.max(4.0, +(5.0 + (s - 1.0) * 1.0).toFixed(1));
    cs = +(3.5 + (s >= 3.0 ? 0.3 : 0)).toFixed(1);
    od = Math.max(3.0, +(4.0 + (s - 1.0) * 1.0).toFixed(1));
    hp = Math.max(3.0, +(3.5 + (s - 1.0) * 0.5).toFixed(1));
  }

  return { cs, ar, od, hp, isExact: false };
}

/**
 * Returns instant difficulty stats for a beatmap (from cache, map object, or formula)
 * and schedules an async background mirror fetch to get exact values.
 */
export function getBeatmapStats(beatmap: Beatmap): BeatmapDifficultyStats {
  if (!beatmap) return { cs: 4, ar: 9, od: 8, hp: 6 };

  // 1. Check in-memory cache
  if (statsCache.has(beatmap.id)) {
    return statsCache.get(beatmap.id)!;
  }

  // 2. Compute immediate estimate
  const estimated = estimateBeatmapStats(beatmap.stars);
  statsCache.set(beatmap.id, estimated);

  // 3. Trigger lightweight background mirror fetch if not already in progress
  if (!pendingFetches.has(beatmap.id)) {
    pendingFetches.add(beatmap.id);
    fetchExactStats(beatmap.id).then((exact) => {
      pendingFetches.delete(beatmap.id);
      if (exact) {
        statsCache.set(beatmap.id, exact);
      }
    });
  }

  return estimated;
}

async function fetchExactStats(beatmapId: number): Promise<BeatmapDifficultyStats | null> {
  try {
    const res = await fetch(`https://api.sayobot.cn/v2/beatmapinfo?0=${beatmapId}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const bidData = json.data?.bid_data?.find((b: any) => Number(b.bid) === Number(beatmapId));
    if (bidData) {
      return {
        cs: Number(bidData.CS || 4),
        ar: Number(bidData.AR || 9),
        od: Number(bidData.OD || 8),
        hp: Number(bidData.HP || 6),
        isExact: true,
      };
    }
  } catch {}
  return null;
}
