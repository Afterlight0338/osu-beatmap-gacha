export interface ChangelogVersion {
  version: string;
  date: string;
  title: string;
  highlight: string;
  details: string[];
  keyPromotions?: {
    artist: string;
    title: string;
    fromTier: string;
    toTier: string;
    reason: string;
  }[];
}

export const CHANGELOG_VERSIONS: ChangelogVersion[] = [
  {
    version: "v5.1",
    date: "Current Release",
    title: "Multi-Factor MCDA Model & GOAT Top 25 Expansion",
    highlight: "Comprehensive shift from linear scoring to Multi-Criteria Decision Analysis (MCDA) across 4 dimensions with Pareto frontier classification and GOAT expanded to top 25 community monuments.",
    details: [
      "Replaced static linear popularity formula with 4-dimensional empirical CDF analysis: Reach (Playcount), Community Affection (Favourites), Passion Conversion Ratio (Favs/Plays), and Historical Era Standing.",
      "Implemented Non-Linear Minkowski Aggregation (p = 3.0) with Pareto peak dominance bonuses so maps with extraordinary metrics in one dimension achieve their rightful high tier.",
      "Expanded 🐐 GOAT tier to the top 25 all-time legendary beatmaps (including USSEEWA, Yoru ni Kakeru, Bad Apple!!, Guren no Yumiya, Blue Bird, Rockefeller Street, Kaikai Kitan, Chikatto Chika Chika, and Fukashigi no Karte).",
      "Rebalanced full pool into a clean pyramid distribution: 25 GOAT, 75 Divine, 150 Celestial, 350 Mythic, 800 Legendary, 2,600 Epic, 6,000 Rare, 8,000 Uncommon+, 9,000 Uncommon, and 10,102 Common.",
      "Added dramatic escalating reveal animations and custom audio builds for all high tiers (Legendary through GOAT)."
    ],
    keyPromotions: [
      { artist: "Ado", title: "USSEEWA", fromTier: "Divine", toTier: "GOAT", reason: "Exceptional 2.02‰ passion ratio & 24k+ favourites" },
      { artist: "YOASOBI", title: "Yoru ni Kakeru", fromTier: "Divine", toTier: "GOAT", reason: "Viral phenomenon with 28.7k favourites" },
      { artist: "Masayoshi Minoshima ft. nomico", title: "Bad Apple!!", fromTier: "Celestial", toTier: "GOAT", reason: "Classic Era 2010 #1 historical legend" },
      { artist: "Camellia", title: "Flamewall", fromTier: "Celestial", toTier: "Divine", reason: "Outstanding 1.36‰ community passion ratio" },
      { artist: "Kanno Yugo", title: "il vento d'oro", fromTier: "Celestial", toTier: "Divine", reason: "2.17‰ conversion rate with 14.6k favourites" },
      { artist: "Porter Robinson", title: "Flicker", fromTier: "Legendary", toTier: "Celestial", reason: "10.9‰ affection-to-exposure ratio" }
    ]
  },
  {
    version: "v4.2",
    date: "August 2026",
    title: "10-Tier Redistribution & 100-Pull Legendary+ Pity",
    highlight: "Introduction of the 10-tier rarity hierarchy (GOAT down to Common) and full 100-pull pity guarantee system.",
    details: [
      "Introduced 10 distinct rarity tiers with dedicated color palettes and VFX.",
      "Implemented 100-pull pity system with soft pity ramping from pull 80 to 99, guaranteeing a 5★+ card at pull 100.",
      "Weighted favorite counts more heavily to elevate iconic tournament and marathon classics like Yomi yori, Freedom Dive, and Everything will freeze.",
      "Added synchronized audio pausing across all modal transitions and summon actions."
    ]
  },
  {
    version: "v4.0",
    date: "August 2026",
    title: "37,102 Unique Beatmapset Ingestion",
    highlight: "Initial deduplication and full-scale database ingestion covering 37,102 beatmapsets.",
    details: [
      "Filtered out duplicate difficulties by anchoring each beatmapset to its highest difficulty while summing playcounts across all diffs.",
      "Integrated IndexedDB offline local caching for rapid loading.",
      "Added multi-banner summon system (Aim & Jump, High BPM & Stream, Community Classics)."
    ]
  }
];
