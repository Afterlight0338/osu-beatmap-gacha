import { RarityTier } from '../types/beatmap';
import { RarityRates } from '../types/gacha';
import { RARITY_ORDER } from './rarity';

/**
 * Base pull probabilities across all 10 rarity tiers.
 * - GOAT: 0.01%
 * - Divine: 0.05%
 * - Celestial: 0.10%
 * - Mythic: 0.25%
 * - Legendary: 0.75%
 * - Epic: 3.00%
 * - Rare: 10.00%
 * - Uncommon+: 26.00%
 * - Uncommon: 29.00%
 * - Common: 30.84%
 * Sum: Exactly 100.0%
 */
export const DEFAULT_RARITY_RATES: RarityRates = {
  Common: 0.3080,    // 30.80%
  Uncommon: 0.2900,  // 29.00%
  'Uncommon+': 0.2600, // 26.00%
  Rare: 0.1000,      // 10.00%
  Epic: 0.0300,      // 3.00%
  Legendary: 0.0075, // 0.75%
  Mythic: 0.0025,    // 0.25%
  Celestial: 0.0010, // 0.10%
  Divine: 0.0005,    // 0.05%
  GOAT: 0.0001,      // 0.01%
  EX: 0.0004,        // 0.04%
};

/**
 * 100-Pull Pity System:
 * - Pulls 0-79: Standard Base Rates
 * - Pulls 80-99 (Soft Pity): Ramping up Legendary or higher probability on each pull
 * - Pull 100 (Hard Pity): 100% Guaranteed Legendary or higher (Legendary, Mythic, Celestial, Divine, GOAT, EX)
 */
export function getPityRates(pityCount: number, baseRates: RarityRates = DEFAULT_RARITY_RATES): RarityRates {
  // Hard pity at 100 pulls (pityCount >= 99 when 0-indexed)
  if (pityCount >= 99) {
    return {
      Common: 0,
      Uncommon: 0,
      'Uncommon+': 0,
      Rare: 0,
      Epic: 0,
      Legendary: 0.6300,
      Mythic: 0.2100,
      Celestial: 0.0850,
      Divine: 0.0450,
      GOAT: 0.0100,
      EX: 0.0200,
    };
  }

  // Pulls 0 to 78: Standard base rates
  if (pityCount < 79) {
    return baseRates;
  }

  // Soft pity: pulls 80 to 99 (pityCount 79 to 98)
  const steps = pityCount - 78; // 1 at pull 80, 20 at pull 99
  const extraLegendaryPlus = Math.min(0.95, steps * 0.0475);

  const baseLegendaryPlus =
    (baseRates.Legendary || 0) +
    (baseRates.Mythic || 0) +
    (baseRates.Celestial || 0) +
    (baseRates.Divine || 0) +
    (baseRates.GOAT || 0) +
    (baseRates.EX || 0);
  const newLegendaryPlus = Math.min(0.999, baseLegendaryPlus + extraLegendaryPlus);

  const scaleFactor = Math.max(0, (1 - newLegendaryPlus) / (1 - baseLegendaryPlus));
  const boostFactor = newLegendaryPlus / baseLegendaryPlus;

  return {
    Common: (baseRates.Common || 0) * scaleFactor,
    Uncommon: (baseRates.Uncommon || 0) * scaleFactor,
    'Uncommon+': (baseRates['Uncommon+'] || 0) * scaleFactor,
    Rare: (baseRates.Rare || 0) * scaleFactor,
    Epic: (baseRates.Epic || 0) * scaleFactor,
    Legendary: (baseRates.Legendary || 0) * boostFactor,
    Mythic: (baseRates.Mythic || 0) * boostFactor,
    Celestial: (baseRates.Celestial || 0) * boostFactor,
    Divine: (baseRates.Divine || 0) * boostFactor,
    GOAT: (baseRates.GOAT || 0) * boostFactor,
    EX: (baseRates.EX || 0) * boostFactor,
  };
}

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
