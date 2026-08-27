import { Beatmap } from './beatmap';

export type BountyRankRequirement = 'Pass' | 'A' | 'S' | 'SS';
export type BountyDifficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | 'Master' | 'Boss';

export interface BountyRequirement {
  minRank: BountyRankRequirement;
  minAccuracy?: number; // e.g. 95.0 for 95%
  requiredMods?: string[]; // e.g. ['HD'] or ['HR'] or ['DT'] or [] for any
  minComboPercent?: number; // e.g. 80 for 80% of max combo
}

export interface Bounty {
  id: string;
  beatmap: Beatmap;
  title: string;
  description: string;
  difficulty: BountyDifficulty;
  requirements: BountyRequirement;
  rewardStamina: number;
  rewardPoints: number;
  createdAt: number;
  isBoss?: boolean;
  bossReason?: string; // Reason / lore why this song was chosen by admin
  packId?: string; // If part of a curated Bounty Pack
  packName?: string;
}

export interface ActiveBounty {
  bounty: Bounty;
  startedAt: number; // timestamp when player accepted the bounty
}

export interface CompletedBounty {
  id: string;
  bountyId: string;
  beatmapId: number;
  beatmapTitle: string;
  beatmapArtist: string;
  beatmapVersion: string;
  stars: number;
  difficulty?: BountyDifficulty;
  scoreId: number | string;
  scoreRank: string;
  scoreAccuracy: number;
  scoreMods: string[];
  scorePp: number;
  completedAt: number;
  rewardStamina: number;
  rewardPoints: number;
  isBoss?: boolean;
  bossReason?: string;
  packId?: string;
}

export interface BountyPack {
  id: string;
  title: string;
  description: string;
  themeColor?: string; // 'red' | 'purple' | 'amber' | 'emerald' | 'cyan'
  bannerUrl?: string;
  bounties: Bounty[];
  bonusRewardStamina: number; // e.g. 500
  bonusRewardPoints: number; // e.g. 500
  badgeTitle?: string; // e.g. 'Dragon Slayer'
  active: boolean;
  createdAt: number;
}

export interface CompletedPackRecord {
  packId: string;
  completedAt: number;
  bonusStamina: number;
  bonusPoints: number;
}

export interface OsuScoreData {
  id: number | string;
  userId: number;
  username: string;
  avatarUrl: string;
  beatmapId: number;
  beatmapTitle: string;
  beatmapArtist: string;
  beatmapVersion: string;
  stars: number;
  rank: string;
  passed: boolean;
  accuracy: number;
  maxCombo: number;
  totalScore: number;
  pp: number;
  mods: string[];
  endedAt: number;
  startedAt?: number | null;
}
