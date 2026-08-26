import { RarityTier } from './beatmap';

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
  lockedRarity?: RarityTier;
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
  /** If admin has queued an energy override for this user, the amount to set */
  energyOverride?: number | null;
  /** Global admin config: rates, stamina max, etc. */
  config?: Record<string, unknown>;
}

export interface CloudPushResponse {
  success: boolean;
  synced: boolean;
  uniqueCards: number;
  totalCopies: number;
  timestamp: number;
  error?: string;
}
