import { Beatmap, RarityTier, BeatmapStatus } from './beatmap';

export interface CollectionRecord {
  beatmapId: number;
  copies: number;
  firstPulledAt: number;
  lastPulledAt: number;
  isFavorite?: boolean;
}

export interface CollectionItemWithMap extends CollectionRecord {
  beatmap: Beatmap;
}

export type SortField =
  | 'recent'
  | 'copies'
  | 'rarity'
  | 'stars'
  | 'playcount'
  | 'favourites'
  | 'title'
  | 'artist'
  | 'bpm'
  | 'length'
  | 'rankedDate';

export type SortOrder = 'asc' | 'desc';

export interface CollectionFilters {
  search: string;
  rarity: RarityTier | 'All';
  status: BeatmapStatus | 'All';
  minStars: number;
  maxStars: number;
  ownership: 'all' | 'owned' | 'unowned' | 'favorites';
  sortField: SortField;
  sortOrder: SortOrder;
}

export interface CollectionStats {
  totalPulls: number;
  uniqueOwned: number;
  totalCopies: number;
  completionPercentage: number;
  rarityCounts: Record<RarityTier, number>;
  totalInPool: number;
  highestRarityObtained: RarityTier | null;
  averageStarRating: number;
  mostCopiesMap: {
    beatmap: Beatmap;
    copies: number;
  } | null;
}

export interface PullEnergyState {
  /** Main stamina (0-50), regenerates +1 every 15s */
  current: number;
  /** Max main stamina cap (default 50) */
  max: number;
  /** Reserve / Leftover stamina (0-100), accumulates when main stamina is full */
  reserve: number;
  /** Max reserve cap (default 100) */
  reserveMax: number;
  /** Bonus stamina (uncapped), from giveaways, admin gifts, math questions */
  bonus: number;
  /** Last passive recovery tick timestamp */
  lastRefillTime: number;
}

export interface UserSettings {
  soundEnabled: boolean;
  sfxVolume: number;
  bgmVolume: number;
  fastAnimation: boolean;
  theme: 'dark';
}

export interface CollectionExportData {
  version: number;
  exportedAt: string;
  stats: {
    totalPulls: number;
  };
  records: CollectionRecord[];
  history: Array<{
    id: string;
    beatmapId: number;
    rarity: RarityTier;
    isNew: boolean;
    pulledAt: number;
  }>;
  settings?: UserSettings;
}
