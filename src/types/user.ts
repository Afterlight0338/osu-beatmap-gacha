export interface OsuUserProfile {
  id: number;
  username: string;
  avatarUrl: string;
  countryCode?: string;
  globalRank?: number | null;
  pp?: number | null;
  coverUrl?: string;
  isSupporter?: boolean;
}

export interface CloudSaveData {
  userId: number;
  username: string;
  version: string;
  lastSyncedAt: number;
  collection: Array<{
    beatmapId: number;
    copies: number;
    firstPulledAt: number;
    lastPulledAt: number;
    isFavorite: boolean;
  }>;
  history: Array<{
    id: string;
    beatmapId: number;
    rarity: string;
    isNew: boolean;
    pulledAt: number;
  }>;
  energy: {
    current: number;
    max: number;
    lastRefillTime: number;
  };
  stats: {
    totalPulls: number;
  };
}

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
