import { RarityTier } from '../types/beatmap';
import { RarityRates } from '../types/gacha';

/**
 * Base pull probabilities across all rarity tiers.
 * Total sum equals 1.0 (100%).
 */
export const DEFAULT_RARITY_RATES: RarityRates = {
  Common: 0.40,      // 40.0%
  Uncommon: 0.346,   // 34.6%
  Rare: 0.18,        // 18.0%
  Epic: 0.06,        //  6.0%
  Legendary: 0.01,   //  1.0%
  Mythic: 0.0025,    //  0.25%
  Divine: 0.001,     //  0.1%
  GOAT: 0.0005,      //  0.05%
};

/**
 * Probabilities when a pull is guaranteed to be Rare or higher (e.g. 10th pull of a multi-pull).
 */
export const GUARANTEED_RARE_RATES: RarityRates = {
  Common: 0.0,
  Uncommon: 0.0,
  Rare: 0.65,        // 65%
  Epic: 0.25,        // 25%
  Legendary: 0.08,   //  8%
  Mythic: 0.015,     //  1.5%
  Divine: 0.004,     //  0.4%
  GOAT: 0.001,       //  0.1%
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
  const tiers: RarityTier[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Divine', 'GOAT'];
  return tiers.map((tier) => {
    acc += rates[tier] || 0;
    return { tier, threshold: acc };
  });
}
