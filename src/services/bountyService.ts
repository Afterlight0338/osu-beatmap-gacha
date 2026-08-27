import { Beatmap } from '../types/beatmap';
import { Bounty, BountyDifficulty, BountyRankRequirement, ActiveBounty, CompletedBounty, BountyPack, CompletedPackRecord } from '../types/bounty';
import { supabase } from '../lib/supabase';

const STORAGE_AVAILABLE_BOUNTIES = 'osu_gacha_available_bounties_v1';
const STORAGE_ACTIVE_BOUNTY = 'osu_gacha_active_bounty_v1';
const STORAGE_COMPLETED_BOUNTIES = 'osu_gacha_completed_bounties_v1';
const STORAGE_CLAIMED_SCORE_IDS = 'osu_gacha_claimed_score_ids_v1';
const STORAGE_COMPLETED_PACKS = 'osu_gacha_completed_packs_v1';

const BOUNTY_TITLES: Record<BountyDifficulty, string[]> = {
  Beginner: [
    'Warm-Up Rhythm',
    'Rhythm Initiate',
    'Steady Clicks',
    'Cadence Novice',
    'Groove Starter',
    'Flow Seeker',
  ],
  Intermediate: [
    'Precision Striker',
    'Beat Conductor',
    'Finger Control Adept',
    'Syncopation Specialist',
    'Echo Chaser',
    'Tempo Master',
  ],
  Advanced: [
    'Starlight Acrobat',
    'Velocity Virtuoso',
    'Stream Weaver',
    'High-Speed Sentinel',
    'Reflex Artisan',
    'Rhythm Overdrive',
  ],
  Expert: [
    'Dragonflame Slayer',
    'Apex Champion',
    'Stamina Titan',
    'Hyperdrive Conqueror',
    'Infinite Velocity',
    'Grandmaster of Circles',
  ],
  Master: [
    'God of Rhythm',
    'Celestial Executioner',
    'Transcendent Master',
    'Mythic S-Ranker',
  ],
  Boss: [
    '👑 RAID BOSS: Apocalyptic Calamity',
    '👑 RAID BOSS: Final Apex Conqueror',
    '👑 RAID BOSS: Legendary Ascendant',
    '👑 RAID BOSS: Abyssal Nightmare',
  ],
};

export const BOUNTY_STAMINA_REWARDS: Record<BountyDifficulty, number> = {
  Beginner: 25,
  Intermediate: 50,
  Advanced: 80,
  Expert: 120,
  Master: 200,
  Boss: 300,
};

export const BOUNTY_POINTS_REWARDS: Record<BountyDifficulty, number> = {
  Beginner: 10,
  Intermediate: 25,
  Advanced: 50,
  Expert: 100,
  Master: 200,
  Boss: 300,
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRandomBounties(pool: Beatmap[], count: number = 10): Bounty[] {
  if (!pool || pool.length === 0) return [];

  // Filter pool by difficulty tiers with realistic star caps (max cap <= 8.2 to prevent impossible 11★ maps)
  const beginnerPool = pool.filter((m) => m.stars >= 2.0 && m.stars <= 3.8);
  const intermediatePool = pool.filter((m) => m.stars >= 3.9 && m.stars <= 5.2);
  const advancedPool = pool.filter((m) => m.stars >= 5.3 && m.stars <= 6.3);
  const expertPool = pool.filter((m) => m.stars >= 6.4 && m.stars <= 7.4);
  const masterPool = pool.filter((m) => m.stars >= 7.5 && m.stars <= 8.2);

  const bounties: Bounty[] = [];

  const tierDistribution: { tier: BountyDifficulty; pool: Beatmap[]; count: number }[] = [
    { tier: 'Beginner', pool: beginnerPool.length ? beginnerPool : pool.filter((m) => m.stars < 4.0), count: 2 },
    { tier: 'Intermediate', pool: intermediatePool.length ? intermediatePool : pool.filter((m) => m.stars >= 3.8 && m.stars < 5.3), count: 3 },
    { tier: 'Advanced', pool: advancedPool.length ? advancedPool : pool.filter((m) => m.stars >= 5.3 && m.stars < 6.4), count: 3 },
    { tier: 'Expert', pool: expertPool.length ? expertPool : pool.filter((m) => m.stars >= 6.4 && m.stars <= 7.5), count: masterPool.length ? 1 : 2 },
  ];

  if (masterPool.length > 0) {
    tierDistribution.push({ tier: 'Master', pool: masterPool, count: 1 });
  }

  for (const group of tierDistribution) {
    const validGroupPool = group.pool.length ? group.pool : pool;
    for (let i = 0; i < group.count; i++) {
      const map = pickRandom(validGroupPool);
      if (!map) continue;

      let minRank: BountyRankRequirement = 'A';
      let minAccuracy: number | undefined = undefined;
      let requiredMods: string[] | undefined = undefined;

      if (group.tier === 'Beginner') {
        minRank = Math.random() > 0.4 ? 'S' : 'A';
        if (Math.random() > 0.5) minAccuracy = 94.0;
      } else if (group.tier === 'Intermediate') {
        minRank = Math.random() > 0.3 ? 'S' : 'A';
        minAccuracy = Math.random() > 0.4 ? 95.0 : undefined;
        if (Math.random() > 0.8) requiredMods = ['HD'];
      } else if (group.tier === 'Advanced') {
        minRank = Math.random() > 0.4 ? 'A' : 'S';
        minAccuracy = Math.random() > 0.4 ? 94.0 : undefined;
        if (Math.random() > 0.7) requiredMods = Math.random() > 0.5 ? ['HD'] : ['HR'];
      } else if (group.tier === 'Expert') {
        // Expert (6.4 - 7.4★): Reasonable requirements (Pass or B/A rank, no absurd 95%+ requirements)
        minRank = Math.random() > 0.5 ? 'A' : 'Pass';
        minAccuracy = Math.random() > 0.7 ? 92.0 : undefined;
      } else {
        // Master (7.5 - 8.2★): Simply require PASS
        minRank = 'Pass';
        minAccuracy = undefined;
      }

      const titleList = BOUNTY_TITLES[group.tier] || BOUNTY_TITLES.Intermediate;
      const title = pickRandom(titleList);

      let desc = `Pass with Rank ${minRank} or higher`;
      if (minAccuracy) desc += ` & ≥${minAccuracy}% Acc`;
      if (requiredMods && requiredMods.length > 0) desc += ` (+${requiredMods.join(', ')})`;

      const rewardStamina = BOUNTY_STAMINA_REWARDS[group.tier] || 50;
      const rewardPoints = BOUNTY_POINTS_REWARDS[group.tier] || 25;

      bounties.push({
        id: `bounty-${map.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        beatmap: map,
        title,
        description: desc,
        difficulty: group.tier,
        requirements: {
          minRank,
          minAccuracy,
          requiredMods,
        },
        rewardStamina,
        rewardPoints,
        createdAt: Date.now(),
      });
    }
  }

  // Fallback fill if needed
  while (bounties.length < count && pool.length > 0) {
    const map = pickRandom(pool);
    bounties.push({
      id: `bounty-${map.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      beatmap: map,
      title: 'Rhythm Challenge',
      description: 'Pass with Rank A or higher',
      difficulty: 'Intermediate',
      requirements: { minRank: 'A' },
      rewardStamina: 50,
      rewardPoints: 25,
      createdAt: Date.now(),
    });
  }

  return bounties.slice(0, count);
}

// ── Storage Helpers ──────────────────────────────────────────────────────────

export function loadSavedBounties(): Bounty[] {
  try {
    const raw = localStorage.getItem(STORAGE_AVAILABLE_BOUNTIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAvailableBounties(bounties: Bounty[]): void {
  try {
    localStorage.setItem(STORAGE_AVAILABLE_BOUNTIES, JSON.stringify(bounties));
  } catch {}
}

export function loadActiveBounty(): ActiveBounty | null {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE_BOUNTY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveActiveBounty(active: ActiveBounty | null): void {
  try {
    if (active) {
      localStorage.setItem(STORAGE_ACTIVE_BOUNTY, JSON.stringify(active));
    } else {
      localStorage.removeItem(STORAGE_ACTIVE_BOUNTY);
    }
  } catch {}
}

export function loadCompletedBounties(): CompletedBounty[] {
  try {
    const raw = localStorage.getItem(STORAGE_COMPLETED_BOUNTIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveCompletedBounty(
  completed: CompletedBounty,
  user?: { osuId: number; username: string; avatarUrl?: string | null }
): Promise<void> {
  try {
    const prev = loadCompletedBounties();
    const updated = [completed, ...prev].slice(0, 50); // Keep last 50
    localStorage.setItem(STORAGE_COMPLETED_BOUNTIES, JSON.stringify(updated));

    // Also record claimed score ID
    const claimed = loadClaimedScoreIds();
    claimed.add(String(completed.scoreId));
    localStorage.setItem(STORAGE_CLAIMED_SCORE_IDS, JSON.stringify(Array.from(claimed)));

    // Sync to Supabase admin_config bounties_cleared_by_user
    if (user?.osuId) {
      try {
        const { data } = await supabase
          .from('admin_config')
          .select('value')
          .eq('key', 'bounties_cleared_by_user')
          .maybeSingle();

        const currentMap =
          data?.value && typeof data.value === 'object' && !Array.isArray(data.value)
            ? (data.value as Record<string, { count: number; points?: number; username: string; avatarUrl?: string; lastClearedAt: number; recentBounties?: CompletedBounty[] }>)
            : {};

        const userKey = String(user.osuId);
        const existing = currentMap[userKey] || {
          count: 0,
          points: 0,
          username: user.username,
          avatarUrl: user.avatarUrl || undefined,
          lastClearedAt: Date.now(),
          recentBounties: [],
        };

        const existingHistory = Array.isArray(existing.recentBounties) ? existing.recentBounties : [];
        const updatedHistory = [completed, ...existingHistory.filter((b) => String(b.scoreId) !== String(completed.scoreId))].slice(0, 50);

        currentMap[userKey] = {
          count: (existing.count || 0) + 1,
          points: (existing.points || 0) + (completed.rewardPoints || 25),
          username: user.username,
          avatarUrl: user.avatarUrl || undefined,
          lastClearedAt: Date.now(),
          recentBounties: updatedHistory,
        };

        await supabase.from('admin_config').upsert({
          key: 'bounties_cleared_by_user',
          value: currentMap,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Failed to sync bounty clear count to Supabase:', err);
      }
    }
  } catch (e) {
    console.warn('Failed to save completed bounty:', e);
  }
}

export function loadClaimedScoreIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_CLAIMED_SCORE_IDS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export interface GlobalBountyUserStat {
  count: number;
  points: number;
  lastClearedAt: number;
}

export async function fetchGlobalBountyClears(): Promise<Record<number, GlobalBountyUserStat>> {
  try {
    const { data } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'bounties_cleared_by_user')
      .maybeSingle();

    if (!data?.value || typeof data.value !== 'object') return {};
    const result: Record<number, GlobalBountyUserStat> = {};
    for (const [osuIdStr, val] of Object.entries(data.value as Record<string, any>)) {
      const osuId = Number(osuIdStr);
      if (osuId && val) {
        const count = Number(val.count || 0);
        const points = typeof val.points === 'number' ? val.points : count * 25;
        result[osuId] = {
          count,
          points,
          lastClearedAt: Number(val.lastClearedAt || 0),
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

export async function fetchUserBountyHistory(osuId: number): Promise<CompletedBounty[]> {
  try {
    const { data } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'bounties_cleared_by_user')
      .maybeSingle();

    if (data?.value && typeof data.value === 'object') {
      const userStat = (data.value as Record<string, any>)[String(osuId)];
      if (userStat && Array.isArray(userStat.recentBounties)) {
        return userStat.recentBounties;
      }
    }
  } catch {}
  return [];
}

// ── Boss Bounties Management ──────────────────────────────────────────────────

export async function fetchBossBounties(): Promise<Bounty[]> {
  try {
    const { data } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'boss_bounties')
      .maybeSingle();

    if (data?.value && Array.isArray(data.value)) {
      return data.value as Bounty[];
    }
  } catch (err) {
    console.warn('Failed to load boss bounties from Supabase:', err);
  }
  return [];
}

export async function saveBossBounties(bounties: Bounty[]): Promise<boolean> {
  try {
    const { error } = await supabase.from('admin_config').upsert({
      key: 'boss_bounties',
      value: bounties,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch (err) {
    console.warn('Failed to save boss bounties to Supabase:', err);
    return false;
  }
}

// ── Bounty Packs Management ───────────────────────────────────────────────────

export async function fetchBountyPacks(): Promise<BountyPack[]> {
  try {
    const { data } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'bounty_packs')
      .maybeSingle();

    if (data?.value && Array.isArray(data.value)) {
      return data.value as BountyPack[];
    }
  } catch (err) {
    console.warn('Failed to load bounty packs from Supabase:', err);
  }
  return [];
}

export async function saveBountyPacks(packs: BountyPack[]): Promise<boolean> {
  try {
    const { error } = await supabase.from('admin_config').upsert({
      key: 'bounty_packs',
      value: packs,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch (err) {
    console.warn('Failed to save bounty packs to Supabase:', err);
    return false;
  }
}

export function loadCompletedPacks(): CompletedPackRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_COMPLETED_PACKS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCompletedPack(packRecord: CompletedPackRecord): void {
  try {
    const prev = loadCompletedPacks();
    const updated = [packRecord, ...prev.filter((p) => p.packId !== packRecord.packId)];
    localStorage.setItem(STORAGE_COMPLETED_PACKS, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save completed pack:', err);
  }
}
