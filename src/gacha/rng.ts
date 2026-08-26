import { Beatmap, RarityTier } from '../types/beatmap';
import { PullResult, RarityRates } from '../types/gacha';
import { CollectionRecord } from '../types/collection';
import { DEFAULT_RARITY_RATES, getPityRates, getCumulativeRates } from './probabilities';
import { filterMapsForBanner } from './banners';

/**
 * Checks if a rarity tier qualifies as Legendary or higher (5★ equivalent for Pity reset).
 */
export function isLegendaryOrHigher(rarity: RarityTier): boolean {
  return (
    rarity === 'Legendary' ||
    rarity === 'Mythic' ||
    rarity === 'Celestial' ||
    rarity === 'Divine' ||
    rarity === 'GOAT' ||
    rarity === 'EX'
  );
}

/**
 * Rolls a random rarity tier using weighted probability.
 */
export function rollRarityTier(rates: RarityRates = DEFAULT_RARITY_RATES): RarityTier {
  const roll = Math.random();
  const cumulative = getCumulativeRates(rates);

  for (const item of cumulative) {
    if (roll <= item.threshold) {
      return item.tier;
    }
  }

  return 'Common';
}

/**
 * Selects a random map from the matching rarity bucket.
 * Uses weighted selection based on popularity score for added realism.
 */
export function selectMapFromTier(mapsInTier: Beatmap[]): Beatmap {
  if (mapsInTier.length === 0) {
    throw new Error('No maps found in rarity tier');
  }

  if (mapsInTier.length === 1) {
    return mapsInTier[0];
  }

  // Weight by popularity score
  const totalWeight = mapsInTier.reduce((sum, map) => sum + Math.max(1, map.popularityScore), 0);
  let randomWeight = Math.random() * totalWeight;

  for (const map of mapsInTier) {
    randomWeight -= Math.max(1, map.popularityScore);
    if (randomWeight <= 0) {
      return map;
    }
  }

  return mapsInTier[Math.floor(Math.random() * mapsInTier.length)];
}

export interface SinglePullResult {
  pull: PullResult;
  nextPityCount: number;
}

/**
 * Performs a single gacha pull from the available map pool with pity scaling.
 */
export function executeSinglePull(
  pool: Beatmap[],
  existingRecords: Map<number, CollectionRecord>,
  bannerId: string = 'standard',
  rates: RarityRates = DEFAULT_RARITY_RATES,
  currentPity: number = 0
): SinglePullResult {
  if (!pool || pool.length === 0) {
    throw new Error('Beatmap pool is empty');
  }

  // Compute effective rates accounting for soft pity (80-99) and hard pity (100)
  const effectiveRates = getPityRates(currentPity, rates);
  let targetTier = rollRarityTier(effectiveRates);

  const bannerMaps = filterMapsForBanner(pool, bannerId);

  // Group maps by rarity
  let mapsInTier = bannerMaps.filter((m) => m.rarity === targetTier);

  // Fallback to full pool if banner filtering yielded 0 maps for this tier
  if (mapsInTier.length === 0) {
    mapsInTier = pool.filter((m) => m.rarity === targetTier);
  }

  // Fallback if that tier has no maps in the dataset at all
  if (mapsInTier.length === 0) {
    const availableTiers = Array.from(new Set(pool.map((m) => m.rarity)));
    if (availableTiers.length > 0) {
      targetTier = availableTiers[Math.floor(Math.random() * availableTiers.length)];
      mapsInTier = pool.filter((m) => m.rarity === targetTier);
    } else {
      mapsInTier = pool;
    }
  }

  const selectedMap = selectMapFromTier(mapsInTier);
  const existing = existingRecords.get(selectedMap.id);

  const previousCopies = existing ? existing.copies : 0;
  const currentCopies = previousCopies + 1;
  const isNew = previousCopies === 0;

  // If Legendary or higher is pulled, reset pity count to 0; otherwise increment by 1
  const nextPityCount = isLegendaryOrHigher(selectedMap.rarity) ? 0 : currentPity + 1;

  return {
    pull: {
      beatmap: selectedMap,
      isNew,
      previousCopies,
      currentCopies,
      pulledAt: Date.now(),
    },
    nextPityCount,
  };
}

export interface MultiPullResult {
  results: PullResult[];
  finalPity: number;
}

/**
 * Performs a multi-pull (e.g. 1x, 5x, 10x pulls) with progressive pity tracking.
 */
export function executeMultiPull(
  count: number,
  pool: Beatmap[],
  existingRecords: Map<number, CollectionRecord>,
  bannerId: string = 'standard',
  initialPity: number = 0,
  rates: RarityRates = DEFAULT_RARITY_RATES
): MultiPullResult {
  const results: PullResult[] = [];
  // Clone record map for sequential tracking inside the multi-pull
  const tempRecords = new Map<number, CollectionRecord>(existingRecords);
  let currentPity = initialPity;

  for (let i = 0; i < count; i++) {
    const { pull, nextPityCount } = executeSinglePull(pool, tempRecords, bannerId, rates, currentPity);
    currentPity = nextPityCount;

    // Update local temp tracking for duplicates inside same multi-pull
    tempRecords.set(pull.beatmap.id, {
      beatmapId: pull.beatmap.id,
      copies: pull.currentCopies,
      firstPulledAt: pull.isNew ? pull.pulledAt : (tempRecords.get(pull.beatmap.id)?.firstPulledAt ?? pull.pulledAt),
      lastPulledAt: pull.pulledAt,
    });

    results.push(pull);
  }

  return {
    results,
    finalPity: currentPity,
  };
}
