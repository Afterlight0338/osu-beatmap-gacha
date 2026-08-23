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
export async function loadBeatmapDataset(): Promise<LoaderResult> {
  if (cachedBeatmaps && cachedInfo) {
    return {
      maps: cachedBeatmaps,
      info: cachedInfo,
      isFallback: false,
    };
  }

  const baseUrl = import.meta.env.BASE_URL || '/';
  const dataUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}data/maps.json`;
  const infoUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}data/dataset-info.json`;

  try {
    const res = await fetch(dataUrl, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} when fetching maps.json`);
    }

    const mapsData: Beatmap[] = await res.json();
    if (!Array.isArray(mapsData) || mapsData.length === 0) {
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

    return {
      maps: mapsData,
      info: infoData,
      isFallback: false,
    };
  } catch (err: any) {
    console.warn('Failed to load live maps.json, using bundled seed dataset fallback:', err.message);

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
