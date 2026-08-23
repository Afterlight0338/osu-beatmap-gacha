import { RarityTier } from '../types/beatmap';
import { RarityRates } from '../types/gacha';

/**
 * Base pull probabilities across all rarity tiers.
 * Total sum equals 1.0 (100%).
 */
export const DEFAULT_RARITY_RATES: RarityRates = {
  Common: 0.55,      // 55.0%
  Uncommon: 0.25,    // 25.0%
  Rare: 0.12,        // 12.0%
  Epic: 0.05,        //  5.0%
  Legendary: 0.02,   //  2.0%
  Mythic: 0.008,     //  0.8%
  Divine: 0.002,     //  0.2%
};

/**
 * Probabilities when a pull is guaranteed to be Rare or higher (e.g. 10th pull of a multi-pull).
 */
export const GUARANTEED_RARE_RATES: RarityRates = {
  Common: 0.0,
  Uncommon: 0.0,
  Rare: 0.60,        // 60%
  Epic: 0.25,        // 25%
  Legendary: 0.10,   // 10%
  Mythic: 0.04,      //  4%
  Divine: 0.01,      //  1%
};

/**
 * Validates that a set of rarity rates sums close to 1.0.
 */
export function validateRates(rates: RarityRates): boolean {
  const sum = Object.values(rates).reduce((acc, r) => acc + r, 0);
  return Math.abs(sum - 1.0) < 0.001;
}

/**
 * Returns cumulative distribution array for RNG sampling.
 */
export function getCumulativeRates(rates: RarityRates): Array<{ tier: RarityTier; threshold: number }> {
  let acc = 0;
  const tiers: RarityTier[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Divine'];
  return tiers.map((tier) => {
    acc += rates[tier] || 0;
    return { tier, threshold: acc };
  });
}
