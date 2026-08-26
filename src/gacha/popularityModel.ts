import { Beatmap, RarityTier } from "../types/beatmap";

export interface PopularityModelConfig {
  weights: {
    reach: number;       // Exposure & playcount
    affection: number;   // Community favourites
    ratio: number;       // Favourite rate per exposure
    era: number;         // Historical era-relative significance
  };
  minkowskiPower: number; // Non-linear aggregation power (p >= 3)
  peakBonuses: {
    topAffection: number; // Bonus for 99.9th+ percentile affection
    highAffection: number; // Bonus for 99.5th+ percentile affection
    topReach: number;     // Bonus for 99.9th+ percentile reach
    highReach: number;    // Bonus for 99.5th+ percentile reach
    topEra: number;       // Bonus for 99.9th+ percentile era performance
    highEra: number;      // Bonus for 99.5th+ percentile era performance
    topRatio: number;     // Bonus for 99.0th+ percentile ratio with >= 1M plays
  };
  marathonBonus: {
    minSeconds: number;
    maxBonus: number;
  };
  starBonus: {
    minStars: number;
    maxBonus: number;
  };
  statusMultipliers: {
    ranked: number;
    approved: number;
    loved: number;
    unranked: number;
  };
  tierCounts: Record<RarityTier, number>;
}

export const DEFAULT_POPULARITY_CONFIG: PopularityModelConfig = {
  weights: {
    reach: 0.35,
    affection: 0.45,
    ratio: 0.10,
    era: 0.10,
  },
  minkowskiPower: 3.0,
  peakBonuses: {
    topAffection: 3.0,
    highAffection: 1.5,
    topReach: 2.5,
    highReach: 1.2,
    topEra: 2.0,
    highEra: 1.0,
    topRatio: 1.5,
  },
  marathonBonus: {
    minSeconds: 240,
    maxBonus: 2.0,
  },
  starBonus: {
    minStars: 6.5,
    maxBonus: 0.8,
  },
  statusMultipliers: {
    ranked: 1.0,
    approved: 1.0,
    loved: 0.985,
    unranked: 0.92,
  },
  tierCounts: {
    EX: 0,
    GOAT: 25,
    Divine: 75,
    Celestial: 150,
    Mythic: 350,
    Legendary: 800,
    Epic: 2600,
    Rare: 6000,
    "Uncommon+": 8000,
    Uncommon: 9000,
    Common: 10102,
  },
};

export interface MultiFactorScore {
  finalScore: number;
  reachPercentile: number;
  affectionPercentile: number;
  ratioPercentile: number;
  eraPercentile: number;
}

/**
 * Calculates empirical percentiles (0 - 100) for an array of items on a given numerical field.
 */
function calculateEmpiricalPercentiles<T>(items: T[], getValue: (item: T) => number): Map<T, number> {
  const sorted = [...items].sort((a, b) => getValue(a) - getValue(b));
  const n = sorted.length;
  const resultMap = new Map<T, number>();
  sorted.forEach((item, idx) => {
    resultMap.set(item, (idx / Math.max(1, n - 1)) * 100);
  });
  return resultMap;
}

/**
 * Computes multi-factor MCDA & Pareto popularity scores and classifies beatmaps into rarity tiers.
 */
export function computeMultiFactorPopularity(
  maps: Beatmap[],
  config: PopularityModelConfig = DEFAULT_POPULARITY_CONFIG
): Beatmap[] {
  interface EnrichedItem {
    map: Beatmap;
    logP: number;
    logF: number;
    ratioRaw: number;
    year: number;
    era: "classic" | "golden" | "modern" | "contemporary";
  }

  const enriched: EnrichedItem[] = maps.map((m) => {
    const p = Math.max(0, m.playcount);
    const f = Math.max(0, m.favouriteCount);
    const logP = Math.log10(p + 1);
    const logF = Math.log10(f + 1);
    const ratioRaw = ((f + 10) / (p + 3000)) * Math.log10(p + 10);

    const year = m.rankedDate
      ? new Date(m.rankedDate).getFullYear()
      : 2020;

    let era: EnrichedItem["era"] = "contemporary";
    if (year <= 2011) era = "classic";
    else if (year <= 2015) era = "golden";
    else if (year <= 2019) era = "modern";

    return { map: m, logP, logF, ratioRaw, year, era };
  });

  const reachPcts = calculateEmpiricalPercentiles(enriched, (i) => i.logP);
  const affectionPcts = calculateEmpiricalPercentiles(enriched, (i) => i.logF);
  const ratioPcts = calculateEmpiricalPercentiles(enriched, (i) => i.ratioRaw);

  const eraPcts = new Map<EnrichedItem, number>();
  (["classic", "golden", "modern", "contemporary"] as const).forEach((eraName) => {
    const cohort = enriched.filter((i) => i.era === eraName);
    const cohortLogP = calculateEmpiricalPercentiles(cohort, (i) => i.logP);
    const cohortLogF = calculateEmpiricalPercentiles(cohort, (i) => i.logF);
    cohort.forEach((item) => {
      const pReach = cohortLogP.get(item) || 0;
      const pAffection = cohortLogF.get(item) || 0;
      eraPcts.set(item, pReach * 0.40 + pAffection * 0.60);
    });
  });

  const p = config.minkowskiPower;
  const { weights, peakBonuses, marathonBonus, starBonus, statusMultipliers } = config;

  interface ScoredResult {
    map: Beatmap;
    score: number;
  }

  const scored: ScoredResult[] = enriched.map((item) => {
    const pReach = reachPcts.get(item) || 0;
    const pAffection = affectionPcts.get(item) || 0;
    const pRatio = ratioPcts.get(item) || 0;
    const pEra = eraPcts.get(item) || 0;

    const minkowskiInner =
      weights.reach * Math.pow(pReach, p) +
      weights.affection * Math.pow(pAffection, p) +
      weights.ratio * Math.pow(pRatio, p) +
      weights.era * Math.pow(pEra, p);

    const baseMCDA = Math.pow(minkowskiInner, 1 / p);

    let peak = 0;
    if (pAffection >= 99.9) peak += peakBonuses.topAffection;
    else if (pAffection >= 99.5) peak += peakBonuses.highAffection;

    if (pReach >= 99.9) peak += peakBonuses.topReach;
    else if (pReach >= 99.5) peak += peakBonuses.highReach;

    if (pEra >= 99.9) peak += peakBonuses.topEra;
    else if (pEra >= 99.5) peak += peakBonuses.highEra;

    if (pRatio >= 99.0 && item.map.playcount >= 1000000) peak += peakBonuses.topRatio;

    const length = item.map.length || 0;
    const lenBonus =
      length >= marathonBonus.minSeconds
        ? Math.min(marathonBonus.maxBonus, ((length - marathonBonus.minSeconds) / 360) * marathonBonus.maxBonus)
        : 0;

    const stars = item.map.stars || 0;
    const sBonus =
      stars >= starBonus.minStars && stars <= 11.0
        ? Math.min(starBonus.maxBonus, ((stars - starBonus.minStars) / 4.0) * starBonus.maxBonus)
        : 0;

    const status = item.map.status || "ranked";
    const statusMult =
      status === "ranked"
        ? statusMultipliers.ranked
        : status === "approved"
        ? statusMultipliers.approved
        : status === "loved"
        ? statusMultipliers.loved
        : statusMultipliers.unranked;

    const finalScore = Math.round((baseMCDA + peak + lenBonus + sBonus) * statusMult * 100) / 100;

    return {
      map: item.map,
      score: finalScore,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.map.playcount - a.map.playcount;
  });

  const {
    GOAT: goatCount,
    Divine: divineCount,
    Celestial: celestialCount,
    Mythic: mythicCount,
    Legendary: legendaryCount,
    Epic: epicCount,
    Rare: rareCount,
    "Uncommon+": uncommonPlusCount,
    Uncommon: uncommonCount,
  } = config.tierCounts;

  const thresholdDivine = goatCount + divineCount;
  const thresholdCelestial = thresholdDivine + celestialCount;
  const thresholdMythic = thresholdCelestial + mythicCount;
  const thresholdLegendary = thresholdMythic + legendaryCount;
  const thresholdEpic = thresholdLegendary + epicCount;
  const thresholdRare = thresholdEpic + rareCount;
  const thresholdUncommonPlus = thresholdRare + uncommonPlusCount;
  const thresholdUncommon = thresholdUncommonPlus + uncommonCount;

  return scored.map((item, idx) => {
    const rank = idx + 1;
    let rarity: RarityTier;

    if (rank <= goatCount) rarity = "GOAT";
    else if (rank <= thresholdDivine) rarity = "Divine";
    else if (rank <= thresholdCelestial) rarity = "Celestial";
    else if (rank <= thresholdMythic) rarity = "Mythic";
    else if (rank <= thresholdLegendary) rarity = "Legendary";
    else if (rank <= thresholdEpic) rarity = "Epic";
    else if (rank <= thresholdRare) rarity = "Rare";
    else if (rank <= thresholdUncommonPlus) rarity = "Uncommon+";
    else if (rank <= thresholdUncommon) rarity = "Uncommon";
    else rarity = "Common";

    return {
      ...item.map,
      popularityScore: item.score,
      rarity,
    };
  });
}
