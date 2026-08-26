export type RarityTier =
  | 'Common'
  | 'Uncommon'
  | 'Uncommon+'
  | 'Rare'
  | 'Epic'
  | 'Legendary'
  | 'Mythic'
  | 'Celestial'
  | 'Divine'
  | 'GOAT'
  | 'EX';

export type BeatmapStatus =
  | 'ranked'
  | 'approved'
  | 'qualified'
  | 'loved'
  | 'unranked'
  | 'graveyard'
  | 'pending'
  | 'wip';

export interface BeatmapCovers {
  cover: string;
  card: string;
  list: string;
  slimcover: string;
}

export interface Beatmap {
  id: number;
  beatmapsetId: number;
  artist: string;
  artistUnicode?: string;
  title: string;
  titleUnicode?: string;
  version: string;
  creator: string;
  creatorId?: number;
  stars: number;
  bpm: number;
  length: number; // in seconds
  status: BeatmapStatus;
  playcount: number;
  favouriteCount: number;
  rankedDate?: string | null;
  covers: BeatmapCovers;
  previewUrl?: string;
  rarity: RarityTier;
  popularityScore: number;
  mode?: number; // 0 = osu!standard
  exReason?: string; // Reason / story why this card is in the EX tier
}

export interface DatasetInfo {
  version: string;
  lastUpdated: string;
  totalMaps: number;
  poolComposition?: {
    globalTopMaps: number;
    eraPoolMaps: number;
    eraStartYear: number;
  };
  rarityCounts: Record<RarityTier, number>;
  source: string;
}
