import { RarityTier } from '../types/beatmap';
import { RarityRates } from '../types/gacha';
import { RARITY_ORDER } from './rarity';

/**
 * Base pull probabilities across all 10 rarity tiers.
 * Exactly matches requested probabilities (sums to 100.0%):
 * GOAT: 0.01%, Divine: 0.09%, Celestial: 0.15%, Mythic: 0.30%, Legendary: 0.75%,
 * Epic: 4.0%, Rare: 12.0%, Uncommon+: 25.0%, Uncommon: 27.7%, Common: 30.0%
 */
export const DEFAULT_RARITY_RATES: RarityRates = {
  Common: 0.30,      // 30.0%
  Uncommon: 0.277,   // 27.7%
  'Uncommon+': 0.25, // 25.0%
  Rare: 0.12,        // 12.0%
  Epic: 0.04,        // 4.0%
  Legendary: 0.0075, // 0.75%
  Mythic: 0.0030,    // 0.30%
  Celestial: 0.0015, // 0.15%
  Divine: 0.0009,    // 0.09%
  GOAT: 0.0001,      // 0.01%
};

/**
 * Probabilities when a pull is guaranteed to be Rare or higher (10th pull of a multi-pull).
 */
export const GUARANTEED_RARE_RATES: RarityRates = {
  Common: 0.0,
  Uncommon: 0.0,
  'Uncommon+': 0.0,
  Rare: 0.68,        // 68.0%
  Epic: 0.22,        // 22.0%
  Legendary: 0.065,  // 6.5%
  Mythic: 0.022,     // 2.2%
  Celestial: 0.008,  // 0.8%
  Divine: 0.004,     // 0.4%
  GOAT: 0.001,       // 0.1%
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
  return RARITY_ORDER.map((tier) => {
    acc += rates[tier] || 0;
    return { tier, threshold: acc };
  });
}
