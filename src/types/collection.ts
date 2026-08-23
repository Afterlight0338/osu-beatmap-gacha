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
  | 'length';

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
