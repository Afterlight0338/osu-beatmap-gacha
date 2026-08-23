export type RarityTier =
  | 'Common'
  | 'Uncommon'
  | 'Rare'
  | 'Epic'
  | 'Legendary'
  | 'Mythic'
  | 'Divine';

export type BeatmapStatus = 'ranked' | 'approved' | 'qualified' | 'loved' | 'unranked';

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
  mode: number; // 0 = osu!standard
}

export interface DatasetInfo {
  version: string;
  lastUpdated: string;
  totalMaps: number;
  rarityCounts: Record<RarityTier, number>;
  source: string;
}
