import { Beatmap, RarityTier } from './beatmap';

export interface PullResult {
  beatmap: Beatmap;
  isNew: boolean;
  previousCopies: number;
  currentCopies: number;
  pulledAt: number;
}

export interface PullHistoryItem {
  id: string;
  beatmapId: number;
  beatmap: Beatmap;
  rarity: RarityTier;
  isNew: boolean;
  pulledAt: number;
}

export interface Banner {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  badge: string;
  themeColor: string;
  featuredMapIds: number[];
  bgImage: string;
}

export type RarityRates = Record<RarityTier, number>;
