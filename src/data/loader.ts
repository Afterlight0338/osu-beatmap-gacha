import { Beatmap, DatasetInfo, RarityTier } from '../types/beatmap';
import { SEED_BEATMAPS, SEED_DATASET_INFO } from './seedData';

let cachedBeatmaps: Beatmap[] | null = null;
let cachedInfo: DatasetInfo | null = null;
const mapLookupCache: Map<number, Beatmap> = new Map();
const mapsetStarRanges: Map<number, { min: number; max: number }> = new Map();

export interface LoaderResult {
  maps: Beatmap[];
  info: DatasetInfo;
  isFallback: boolean;
  error?: string;
}

function updateStarRanges(maps: Beatmap[]) {
  mapsetStarRanges.clear();
  maps.forEach((m) => {
    const existing = mapsetStarRanges.get(m.beatmapsetId);
    if (!existing) {
      mapsetStarRanges.set(m.beatmapsetId, { min: m.stars, max: m.stars });
    } else {
      existing.min = Math.min(existing.min, m.stars);
      existing.max = Math.max(existing.max, m.stars);
    }
  });
}

/**
 * Loads the beatmap pool dataset from public/data/maps.json.
 * Falls back gracefully to bundled seed dataset if loading fails.
 */
import { getDB } from '../storage/db';

export async function loadBeatmapDataset(): Promise<LoaderResult> {
  if (cachedBeatmaps && cachedInfo) {
    return {
      maps: cachedBeatmaps,
      info: cachedInfo,
      isFallback: false,
    };
  }

  // 1. Try reading persistent dataset from IndexedDB for instant 10ms startup
  let dbCachedMaps: Beatmap[] | null = null;
  let dbCachedInfo: DatasetInfo | null = null;
  try {
    const db = await getDB();
    const cachedEntry = await db.get('meta', 'cached_maps_dataset');
    if (cachedEntry && Array.isArray(cachedEntry.maps) && cachedEntry.maps.length > 5000) {
      dbCachedMaps = cachedEntry.maps;
      dbCachedInfo = cachedEntry.info || generateInfoFromMaps(cachedEntry.maps);
    }
  } catch {}

  const baseUrl = import.meta.env.BASE_URL || '/';
  const dataUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}data/maps.json`;
  const infoUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}data/dataset-info.json`;

  try {
    // If we have valid local cache, we can load it instantly
    if (dbCachedMaps && dbCachedInfo) {
      cachedBeatmaps = dbCachedMaps;
      cachedInfo = dbCachedInfo;
      mapLookupCache.clear();
      dbCachedMaps.forEach((m) => mapLookupCache.set(m.id, m));
      updateStarRanges(dbCachedMaps);
    }

    const res = await fetch(dataUrl, { cache: 'no-cache' });
    if (!res.ok) {
      if (dbCachedMaps && dbCachedInfo) {
        return { maps: dbCachedMaps, info: dbCachedInfo, isFallback: false };
      }
      throw new Error(`HTTP ${res.status} when fetching maps.json`);
    }

    const mapsData: Beatmap[] = await res.json();
    if (!Array.isArray(mapsData) || mapsData.length === 0) {
      if (dbCachedMaps && dbCachedInfo) {
        return { maps: dbCachedMaps, info: dbCachedInfo, isFallback: false };
      }
      throw new Error('Received empty or invalid maps array');
    }

    let infoData: DatasetInfo;
    try {
      const infoRes = await fetch(infoUrl);
      if (infoRes.ok) {
        infoData = await infoRes.json();
      } else {
        infoData = generateInfoFromMaps(mapsData);
      }
    } catch {
      infoData = generateInfoFromMaps(mapsData);
    }

    cachedBeatmaps = mapsData;
    cachedInfo = infoData;
    mapLookupCache.clear();
    mapsData.forEach((m) => mapLookupCache.set(m.id, m));
    updateStarRanges(mapsData);

    // Save full catalog to IndexedDB asynchronously
    getDB().then((db) => {
      db.put('meta', { maps: mapsData, info: infoData, savedAt: Date.now() }, 'cached_maps_dataset').catch(() => {});
    }).catch(() => {});

    return {
      maps: mapsData,
      info: infoData,
      isFallback: false,
    };
  } catch (err: any) {
    if (dbCachedMaps && dbCachedInfo) {
      return {
        maps: dbCachedMaps,
        info: dbCachedInfo,
        isFallback: false,
      };
    }

    console.warn('Failed to load live maps.json and no IndexedDB cache, using bundled seed fallback:', err.message);

    cachedBeatmaps = SEED_BEATMAPS;
    cachedInfo = SEED_DATASET_INFO;
    mapLookupCache.clear();
    SEED_BEATMAPS.forEach((m) => mapLookupCache.set(m.id, m));
    updateStarRanges(SEED_BEATMAPS);

    return {
      maps: SEED_BEATMAPS,
      info: SEED_DATASET_INFO,
      isFallback: true,
      error: err.message,
    };
  }
}

/**
 * Helper to compute dataset stats from map array.
 */
function generateInfoFromMaps(maps: Beatmap[]): DatasetInfo {
  const counts: Record<RarityTier, number> = {
    Common: 0,
    Uncommon: 0,
    'Uncommon+': 0,
    Rare: 0,
    Epic: 0,
    Legendary: 0,
    Mythic: 0,
    Celestial: 0,
    Divine: 0,
    GOAT: 0,
    EX: 0,
  };

  maps.forEach((m) => {
    counts[m.rarity] = (counts[m.rarity] || 0) + 1;
  });

  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    totalMaps: maps.length,
    rarityCounts: counts,
    source: 'Client Generated from JSON',
  };
}

/**
 * Synchronous lookup for beatmap by ID (from loaded cache or seed).
 */
export function getBeatmapById(id: number): Beatmap | undefined {
  return mapLookupCache.get(id);
}

/**
 * Returns the min and max star rating range for a beatmapset across all difficulties.
 */
export function getMapsetStarRange(beatmapsetId: number, fallbackStars: number = 0): { min: number; max: number; label: string } {
  const range = mapsetStarRanges.get(beatmapsetId);
  if (!range) {
    return { min: fallbackStars, max: fallbackStars, label: fallbackStars.toFixed(2) };
  }
  if (Math.abs(range.min - range.max) < 0.05) {
    return { min: range.min, max: range.max, label: range.min.toFixed(2) };
  }
  return { min: range.min, max: range.max, label: `${range.min.toFixed(2)} - ${range.max.toFixed(2)}` };
}
