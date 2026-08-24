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
  percentileThreshold: number;
  pullProbability: number;
  soundPitch: number;
}

export const RARITY_ORDER: RarityTier[] = [
  'Common',
  'Uncommon',
  'Uncommon+',
  'Rare',
  'Epic',
  'Legendary',
  'Mythic',
  'Celestial',
  'Divine',
  'GOAT',
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
    percentileThreshold: 0.70,
    pullProbability: 0.3084,    // 30.84%
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
    percentileThreshold: 0.42,
    pullProbability: 0.290,     // 29.0%
    soundPitch: 1.1,
  },
  'Uncommon+': {
    tier: 'Uncommon+',
    stars: 3,
    label: 'UNCOMMON+',
    color: '#0284c7',
    glowColor: 'rgba(2, 132, 199, 0.6)',
    textColor: 'text-sky-300',
    borderColor: 'border-sky-500/60',
    bgGradient: 'from-sky-900/40 via-sky-950/60 to-slate-950/80',
    percentileThreshold: 0.17,
    pullProbability: 0.260,     // 26.0%
    soundPitch: 1.22,
  },
  Rare: {
    tier: 'Rare',
    stars: 4,
    label: 'RARE',
    color: '#8b5cf6',
    glowColor: 'rgba(139, 92, 246, 0.65)',
    textColor: 'text-purple-300',
    borderColor: 'border-purple-500/60',
    bgGradient: 'from-purple-900/40 via-purple-950/60 to-slate-950/80',
    percentileThreshold: 0.05,
    pullProbability: 0.100,     // 10.0%
    soundPitch: 1.35,
  },
  Epic: {
    tier: 'Epic',
    stars: 5,
    label: 'EPIC',
    color: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.75)',
    textColor: 'text-orange-300',
    borderColor: 'border-orange-500/70',
    bgGradient: 'from-orange-900/50 via-orange-950/60 to-slate-950/85',
    percentileThreshold: 0.013,
    pullProbability: 0.030,     // 3.0%
    soundPitch: 1.5,
  },
  Legendary: {
    tier: 'Legendary',
    stars: 6,
    label: 'LEGENDARY',
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.85)',
    textColor: 'text-red-300',
    borderColor: 'border-red-500/80',
    bgGradient: 'from-red-900/50 via-red-950/70 to-slate-950/90',
    percentileThreshold: 0.005,
    pullProbability: 0.0075,    // 0.75%
    soundPitch: 1.7,
  },
  Mythic: {
    tier: 'Mythic',
    stars: 7,
    label: 'MYTHIC',
    color: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.95)',
    textColor: 'text-rose-300',
    borderColor: 'border-rose-500/90',
    bgGradient: 'from-rose-900/50 via-pink-950/70 to-slate-950/95',
    percentileThreshold: 0.002,
    pullProbability: 0.0025,    // 0.25%
    soundPitch: 1.9,
  },
  Celestial: {
    tier: 'Celestial',
    stars: 8,
    label: 'CELESTIAL',
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 1)',
    textColor: 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-indigo-300 animate-pulse font-bold',
    borderColor: 'border-cyan-400',
    bgGradient: 'from-cyan-900/60 via-indigo-950/80 to-slate-950/95',
    percentileThreshold: 0.0008,
    pullProbability: 0.0010,    // 0.10%
    soundPitch: 2.15,
  },
  Divine: {
    tier: 'Divine',
    stars: 9,
    label: 'DIVINE',
    color: '#ec4899',
    glowColor: 'rgba(236, 72, 153, 1)',
    textColor: 'text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 animate-pulse font-bold',
    borderColor: 'border-pink-400',
    bgGradient: 'from-pink-900/60 via-purple-950/80 to-slate-950/95',
    percentileThreshold: 0.0002,
    pullProbability: 0.0005,    // 0.05%
    soundPitch: 2.45,
  },
  GOAT: {
    tier: 'GOAT',
    stars: 10,
    label: 'GOAT',
    color: '#ffd700',
    glowColor: 'rgba(255, 215, 0, 1)',
    textColor: 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-500 font-black animate-pulse',
    borderColor: 'border-yellow-400',
    bgGradient: 'from-amber-600/60 via-yellow-950/80 to-slate-950/95',
    percentileThreshold: 0.0,
    pullProbability: 0.0001,    // 0.01%
    soundPitch: 2.8,
  },
};

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

  const rawScore = 0.70 * boundedPlay + 0.30 * boundedFav;
  return Math.round(rawScore * 10000) / 100;
}

export function getRarityRank(rarity: RarityTier): number {
  return RARITY_ORDER.indexOf(rarity);
}

export function compareRarities(a: RarityTier, b: RarityTier): number {
  return getRarityRank(a) - getRarityRank(b);
}
