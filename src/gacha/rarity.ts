import { RarityTier } from '../types/beatmap';

export interface RarityConfig {
  tier: RarityTier;
  stars: number;
  label: string;
  color: string;
  glowColor: string;
  textColor: string;
  borderColor: string;
  bgGradient: string;
  percentileThreshold: number; // Top X percentile threshold (e.g. 0.0015 for Divine)
  pullProbability: number; // Default pull rate
  soundPitch: number;
}

export const RARITY_ORDER: RarityTier[] = [
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
  'Mythic',
  'Divine',
];

export const RARITY_CONFIGS: Record<RarityTier, RarityConfig> = {
  Common: {
    tier: 'Common',
    stars: 1,
    label: 'COMMON',
    color: '#94a3b8',
    glowColor: 'rgba(148, 163, 184, 0.4)',
    textColor: 'text-slate-300',
    borderColor: 'border-slate-500/50',
    bgGradient: 'from-slate-700/40 via-slate-800/60 to-slate-950/80',
    percentileThreshold: 0.50, // Bottom 50%
    pullProbability: 0.55,    // 55%
    soundPitch: 1.0,
  },
  Uncommon: {
    tier: 'Uncommon',
    stars: 2,
    label: 'UNCOMMON',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.5)',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/60',
    bgGradient: 'from-emerald-900/40 via-emerald-950/60 to-slate-950/80',
    percentileThreshold: 0.25, // Next 25% (50th - 75th percentile)
    pullProbability: 0.25,    // 25%
    soundPitch: 1.15,
  },
  Rare: {
    tier: 'Rare',
    stars: 3,
    label: 'RARE',
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.6)',
    textColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/60',
    bgGradient: 'from-cyan-900/40 via-cyan-950/60 to-slate-950/80',
    percentileThreshold: 0.10, // Next 15% (75th - 90th percentile)
    pullProbability: 0.12,    // 12%
    soundPitch: 1.3,
  },
  Epic: {
    tier: 'Epic',
    stars: 4,
    label: 'EPIC',
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.7)',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/70',
    bgGradient: 'from-purple-900/50 via-purple-950/60 to-slate-950/85',
    percentileThreshold: 0.03, // Next 7% (90th - 97th percentile)
    pullProbability: 0.05,    // 5%
    soundPitch: 1.5,
  },
  Legendary: {
    tier: 'Legendary',
    stars: 5,
    label: 'LEGENDARY',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.85)',
    textColor: 'text-amber-300',
    borderColor: 'border-amber-500/80',
    bgGradient: 'from-amber-600/40 via-amber-950/60 to-slate-950/90',
    percentileThreshold: 0.008, // Next 2.2% (97th - 99.2th percentile)
    pullProbability: 0.02,     // 2%
    soundPitch: 1.75,
  },
  Mythic: {
    tier: 'Mythic',
    stars: 6,
    label: 'MYTHIC',
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.95)',
    textColor: 'text-rose-400',
    borderColor: 'border-rose-500/90',
    bgGradient: 'from-rose-800/50 via-red-950/70 to-slate-950/95',
    percentileThreshold: 0.0015, // Next 0.65% (99.2th - 99.85th percentile)
    pullProbability: 0.008,    // 0.8%
    soundPitch: 2.0,
  },
  Divine: {
    tier: 'Divine',
    stars: 7,
    label: 'DIVINE',
    color: '#ff007f',
    glowColor: 'rgba(255, 0, 127, 1)',
    textColor: 'text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 animate-pulse',
    borderColor: 'border-pink-500',
    bgGradient: 'from-pink-900/60 via-purple-950/80 to-slate-950/95',
    percentileThreshold: 0.0, // Top 0.15% (99.85th - 100th percentile)
    pullProbability: 0.002,   // 0.2%
    soundPitch: 2.4,
  },
};

/**
 * Calculates raw popularity score from playcount and favourite count using log10 transformation.
 */
export function calculatePopularityScore(
  playcount: number,
  favouriteCount: number,
  minPlayLog: number = 0,
  maxPlayLog: number = 7.5,
  minFavLog: number = 0,
  maxFavLog: number = 5.5
): number {
  const playScore = Math.log10(Math.max(0, playcount) + 1);
  const favScore = Math.log10(Math.max(0, favouriteCount) + 1);

  const normPlay = maxPlayLog > minPlayLog ? (playScore - minPlayLog) / (maxPlayLog - minPlayLog) : 0;
  const normFav = maxFavLog > minFavLog ? (favScore - minFavLog) / (maxFavLog - minFavLog) : 0;

  const boundedPlay = Math.max(0, Math.min(1, normPlay));
  const boundedFav = Math.max(0, Math.min(1, normFav));

  // 70% playcount weight + 30% favourite weight
  const rawScore = 0.70 * boundedPlay + 0.30 * boundedFav;
  return Math.round(rawScore * 10000) / 100; // 0.00 - 100.00 score
}

/**
 * Maps a percentile in [0, 1] (where 1.0 is the most popular map) to a RarityTier.
 */
export function getRarityFromPercentile(percentile: number): RarityTier {
  if (percentile >= 0.9985) return 'Divine';     // Top 0.15%
  if (percentile >= 0.9920) return 'Mythic';     // Top 0.8%
  if (percentile >= 0.9700) return 'Legendary';  // Top 3%
  if (percentile >= 0.9000) return 'Epic';       // Top 10%
  if (percentile >= 0.7500) return 'Rare';       // Top 25%
  if (percentile >= 0.5000) return 'Uncommon';   // Top 50%
  return 'Common';                               // Remaining 50%
}

export function getRarityRank(rarity: RarityTier): number {
  return RARITY_ORDER.indexOf(rarity);
}

export function compareRarities(a: RarityTier, b: RarityTier): number {
  return getRarityRank(a) - getRarityRank(b);
}
