export interface OsuAuthUser {
  osuId: number;
  username: string;
  avatarUrl: string | null;
  countryCode: string | null;
  globalRank: number | null;
  createdAt?: string;
  lastLogin?: string;
  totalPulls?: number;
  pityCount?: number;
  uniqueCards?: number;
  totalCopies?: number;
}

export interface CloudSyncCollectionItem {
  beatmapId: number;
  copies: number;
  firstPulledAt: number;
  lastPulledAt: number;
  isFavorite: boolean;
}

export interface CloudSyncHistoryItem {
  id: string;
  beatmapId: number;
  rarity: string;
  pulledAt: number;
}

export interface CloudSyncResponse {
  success: boolean;
  totalPulls?: number;
  pityCount?: number;
  collection?: CloudSyncCollectionItem[];
  history?: CloudSyncHistoryItem[];
  error?: string;
}

export interface CloudPushResponse {
  success: boolean;
  synced: boolean;
  uniqueCards: number;
  totalCopies: number;
  timestamp: number;
  error?: string;
}
