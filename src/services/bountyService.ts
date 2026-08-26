import { Beatmap } from '../types/beatmap';
import { Bounty, BountyDifficulty, BountyRankRequirement, ActiveBounty, CompletedBounty } from '../types/bounty';

const STORAGE_AVAILABLE_BOUNTIES = 'osu_gacha_available_bounties_v1';
const STORAGE_ACTIVE_BOUNTY = 'osu_gacha_active_bounty_v1';
const STORAGE_COMPLETED_BOUNTIES = 'osu_gacha_completed_bounties_v1';
const STORAGE_CLAIMED_SCORE_IDS = 'osu_gacha_claimed_score_ids_v1';

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
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRandomBounties(pool: Beatmap[], count: number = 10): Bounty[] {
  if (!pool || pool.length === 0) return [];

  // Filter pool by difficulty tiers
  const beginnerPool = pool.filter((m) => m.stars >= 1.5 && m.stars < 4.0);
  const intermediatePool = pool.filter((m) => m.stars >= 4.0 && m.stars < 5.3);
  const advancedPool = pool.filter((m) => m.stars >= 5.3 && m.stars < 6.5);
  const expertPool = pool.filter((m) => m.stars >= 6.5);

  const bounties: Bounty[] = [];

  const tierDistribution: { tier: BountyDifficulty; pool: Beatmap[]; count: number }[] = [
    { tier: 'Beginner', pool: beginnerPool.length ? beginnerPool : pool, count: 2 },
    { tier: 'Intermediate', pool: intermediatePool.length ? intermediatePool : pool, count: 3 },
    { tier: 'Advanced', pool: advancedPool.length ? advancedPool : pool, count: 3 },
    { tier: 'Expert', pool: expertPool.length ? expertPool : pool, count: 2 },
  ];

  for (const group of tierDistribution) {
    for (let i = 0; i < group.count; i++) {
      const map = pickRandom(group.pool);
      if (!map) continue;

      let minRank: BountyRankRequirement = 'A';
      let minAccuracy: number | undefined = undefined;
      let requiredMods: string[] | undefined = undefined;

      if (group.tier === 'Beginner') {
        minRank = Math.random() > 0.4 ? 'S' : 'A';
        if (Math.random() > 0.5) minAccuracy = 95.0;
      } else if (group.tier === 'Intermediate') {
        minRank = Math.random() > 0.3 ? 'S' : 'A';
        minAccuracy = Math.random() > 0.4 ? 95.5 : undefined;
        if (Math.random() > 0.7) requiredMods = ['HD'];
      } else if (group.tier === 'Advanced') {
        minRank = Math.random() > 0.4 ? 'A' : 'S';
        minAccuracy = Math.random() > 0.3 ? 96.0 : undefined;
        if (Math.random() > 0.6) requiredMods = Math.random() > 0.5 ? ['HD'] : ['HR'];
      } else {
        // Expert
        minRank = Math.random() > 0.3 ? 'A' : 'Pass';
        minAccuracy = Math.random() > 0.5 ? 94.0 : undefined;
      }

      const titleList = BOUNTY_TITLES[group.tier] || BOUNTY_TITLES.Intermediate;
      const title = pickRandom(titleList);

      let desc = `Pass with Rank ${minRank} or higher`;
      if (minAccuracy) desc += ` & ≥${minAccuracy}% Acc`;
      if (requiredMods && requiredMods.length > 0) desc += ` (+${requiredMods.join(', ')})`;

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
        rewardStamina: 50,
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
  } catch (e) {
    console.warn('Failed to save available bounties:', e);
  }
}

export function loadActiveBounty(): ActiveBounty | null {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE_BOUNTY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveBounty;
  } catch {
    return null;
  }
}

export function saveActiveBounty(active: ActiveBounty | null): void {
  try {
    if (!active) {
      localStorage.removeItem(STORAGE_ACTIVE_BOUNTY);
    } else {
      localStorage.setItem(STORAGE_ACTIVE_BOUNTY, JSON.stringify(active));
    }
  } catch (e) {
    console.warn('Failed to save active bounty:', e);
  }
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

export function saveCompletedBounty(completed: CompletedBounty): void {
  try {
    const prev = loadCompletedBounties();
    const updated = [completed, ...prev].slice(0, 50); // Keep last 50
    localStorage.setItem(STORAGE_COMPLETED_BOUNTIES, JSON.stringify(updated));

    // Also record claimed score ID
    const claimed = loadClaimedScoreIds();
    claimed.add(String(completed.scoreId));
    localStorage.setItem(STORAGE_CLAIMED_SCORE_IDS, JSON.stringify(Array.from(claimed)));
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
