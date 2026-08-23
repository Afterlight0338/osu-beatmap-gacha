import { Beatmap, RarityTier } from '../types/beatmap';
import { PullResult, RarityRates } from '../types/gacha';
import { CollectionRecord } from '../types/collection';
import { DEFAULT_RARITY_RATES, GUARANTEED_RARE_RATES, getCumulativeRates } from './probabilities';
import { filterMapsForBanner } from './banners';
import { compareRarities } from './rarity';

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

/**
 * Performs a single gacha pull from the available map pool.
 */
export function executeSinglePull(
  pool: Beatmap[],
  existingRecords: Map<number, CollectionRecord>,
  bannerId: string = 'standard',
  rates: RarityRates = DEFAULT_RARITY_RATES,
  isGuaranteedRare: boolean = false
): PullResult {
  if (!pool || pool.length === 0) {
    throw new Error('Beatmap pool is empty');
  }

  const effectiveRates = isGuaranteedRare ? GUARANTEED_RARE_RATES : rates;
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

  return {
    beatmap: selectedMap,
    isNew,
    previousCopies,
    currentCopies,
    pulledAt: Date.now(),
  };
}

/**
 * Performs a multi-pull (e.g. 10x pull).
 * Guaranteed at least 1 Rare or higher on 10-pull.
 */
export function executeMultiPull(
  count: number,
  pool: Beatmap[],
  existingRecords: Map<number, CollectionRecord>,
  bannerId: string = 'standard',
  rates: RarityRates = DEFAULT_RARITY_RATES
): PullResult[] {
  const results: PullResult[] = [];
  // Clone record map for sequential tracking inside the multi-pull
  const tempRecords = new Map<number, CollectionRecord>(existingRecords);

  let hasRareOrHigher = false;

  for (let i = 0; i < count; i++) {
    const isLastOfTen = (i + 1) % 10 === 0;
    const forceGuarantee = isLastOfTen && !hasRareOrHigher;

    const pull = executeSinglePull(pool, tempRecords, bannerId, rates, forceGuarantee);

    if (compareRarities(pull.beatmap.rarity, 'Rare') >= 0) {
      hasRareOrHigher = true;
    }

    // Update local temp tracking for duplicates inside same multi-pull
    tempRecords.set(pull.beatmap.id, {
      beatmapId: pull.beatmap.id,
      copies: pull.currentCopies,
      firstPulledAt: pull.isNew ? pull.pulledAt : (tempRecords.get(pull.beatmap.id)?.firstPulledAt ?? pull.pulledAt),
      lastPulledAt: pull.pulledAt,
    });

    results.push(pull);
  }

  return results;
}
