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
    version: "v7.1",
    date: "August 2026",
    title: "⚡ Stamina Synchronization Hardening, Full osu! Grade Support (X / XH / SH) & 727 Pulls Bugfix Compensation",
    highlight: "Comprehensive hotfix eliminating stamina loss on page refresh via dual-layer local-first storage, full osu! API grade verification support for X (SS), XH (Silver SS), and SH (Silver S), and a 727 bonus pulls gift for all players!",
    details: [
      "🎁 727 WYSI Bonus Pulls Gift: Distributed 727 free uncapped bonus pulls to all players in celebration of the hotfix!",
      "⚡ Local-First Stamina Authority: Stamina is now loaded synchronously on frame 1 from localStorage with non-destructive cloud synchronization, permanently preventing stamina resets or wipes upon refreshing.",
      "🎯 Full osu! Rank Verification Support: Added native verification support for X (SS), XH (Silver SS with Hidden/Flashlight), and SH (Silver S with Hidden/Flashlight) grades in bounties and boss challenges.",
      "👑 Boss Songs & Lore Challenges: Added Raid Boss beatmaps with custom lore stories, dedicated 'Why this song?' highlights, and +300 ⚡ / +300 Pts rewards.",
      "📦 Bounty Packs Builder: Curated playlist packs with completion badges, progress tracking, and +500 ⚡ / +500 Pts playlist bonuses.",
      "🧹 Leaderboard Data Sanitization: Purged orphaned fallback-dataset test cards from the global card rarity leaderboard."
    ],
  },
  {
    version: "v7.0",
    date: "Current Release (August 2026)",
    title: "🎵 38,696 1-Song-1-Card Catalog Expansion, Graveyard Landmark Ingestion & Multi-Factor Pyramid Recalculation",
    highlight: "Complete expansion to 38,696 unique song sets across osu! history (2007–2026), 1-Song-1-Card consolidation, inclusion of celebrated Graveyarded landmark beatmaps with ≥250k plays, and full recalculation under our Multi-Factor MCDA Minkowski Popularity Engine into a true natural pyramid distribution.",
    details: [
      "🎵 38,696 Unique Song Catalog: 100% of all unique ranked & loved song sets from 2007 to present, strictly consolidated to 1 card per song (anchored to top difficulty).",
      "🪦 Graveyarded & Unranked Landmark Maps: Expanded database to accept legendary unranked beatmaps with ≥250,000 playcount (e.g. Mikojel's Jump Training #1, Galaxy Collapse, Tengaku, Blue Zenith cuts).",
      "⚖️ Multi-Factor MCDA Minkowski Popularity Engine (p=3.0): Recalculated every single card's popularity score across 4 empirical CDF dimensions: Log10 Playcount Reach, Log10 Community Favourites Affection, Passion Conversion Ratio, and Historical Era Normalization.",
      "📊 True Natural 10-Tier Pyramid: Fixed lower pyramid distribution so Common represents the largest foundational pool: 25 GOAT (0.06%), 75 Divine (0.19%), 150 Celestial (0.39%), 350 Mythic (0.90%), 800 Legendary (2.07%), 2,600 Epic (6.72%), 6,000 Rare (15.51%), 8,000 Uncommon+ (20.67%), 9,000 Uncommon (23.26%), and 11,696 Common (30.23%).",
      "⚡ Upgraded 3-Tier Stamina & Bonus Pull Stacking: Bonus stamina grants and admin rewards now directly stack uncapped into Bonus Stamina, allowing unlimited pull accumulation without overwriting Main (50) or Reserve (100) stamina.",
      "👑 Admin Custom Beatmap Injector: Admin command center can now inject custom beatmaps directly into the live global gacha pool with real-time sync across all players."
    ],
    keyPromotions: [
      { artist: "UNDEAD CORPORATION", title: "Everything will freeze", fromTier: "Divine", toTier: "GOAT", reason: "#1 All-Time MCDA Peak: 63.8M plays, 39.1k favourites, and monumental 8.31★ Time Freeze icon." },
      { artist: "toby fox", title: "MEGALOVANIA", fromTier: "Divine", toTier: "GOAT", reason: "Viral phenomenon: 51.2M plays and osu!'s highest community favourite count (42.0k favs)." },
      { artist: "Panda Eyes & Teminite", title: "Highscore", fromTier: "Divine", toTier: "GOAT", reason: "Historic 66.5M plays & 34.8k favourites Game Over speed/aim milestone." },
      { artist: "Mrs. GREEN APPLE", title: "Inferno (TV Size)", fromTier: "Celestial", toTier: "GOAT", reason: "Modern anime anthem with 57.0M plays and 37.3k community favourites." },
      { artist: "Linked Horizon", title: "Shinzou o Sasageyo! [TV Size]", fromTier: "Celestial", toTier: "GOAT", reason: "Attack on Titan anthem with 63.9M plays and 37.9k favourites." },
      { artist: "Kuba Oms", title: "My Love", fromTier: "Divine", toTier: "GOAT", reason: "76.2M plays: The undisputed starter song of all osu! players worldwide." },
      { artist: "Mikojel", title: "Jump Training #1", fromTier: "New", toTier: "GOAT", reason: "Graveyard Landmark addition: 35.4M plays, 6.7k favourites unranked training staple." }
    ]
  },
  {
    version: "v6.0",
    date: "August 2026",
    title: "💎 EX Handpicked Tier, 3-Tier Stamina Architecture & Dynamic Rates Engine",
    highlight: "Major platform overhaul introducing the handpicked EX Special Tier with custom lore, an uncapped 3-tier stamina system (Main, Reserve 100, Bonus uncapped), global announcement popups, rhythm math quiz minigame, admin live event presets, and dynamic drop rate engine.",
    details: [
      "💎 New EX Special Tier: Added an apex handpicked rarity tier (0.01% - 1% dynamic pull odds) featuring cosmic purple-gold holographic styling, custom vortex anticipation, and confetti explosions.",
      "👑 Manual Card Tier & EX Assignment: Admins can manually assign any ranked beatmap to any rarity tier. EX tier assignments require a mandatory lore description explaining the map's historic significance, which is highlighted whenever pulled by players.",
      "🔋 3-Tier Stamina System: Solved stamina capping! Main Stamina (0-50) recharges every 15s (or 5s during events), Leftover/Reserve Stamina (0-100) passively stores overflow, and Bonus Stamina is completely uncapped for giveaways, events, and math rewards.",
      "🧮 Rhythm Math Quiz Minigame: Added a top navbar math quiz modal with BPM/stream calculations and combo arithmetic, awarding +15 Bonus Stamina on correct answers.",
      "📢 Global Announcement Popup System: Live popup modals with optional claimable bonus stamina gifts and persistent dismissal tracking.",
      "🎉 Admin Live Event Presets: 1-click launcher for Turbo Stamina recovery (5s per point), 1.5x / 2x / 3x rarity multipliers, and automatic global announcement broadcast.",
      "📈 Dynamic Gacha Rates: Live probability calculation dynamically adjusts high-tier odds based on active events and admin multipliers, directly reflected in the summon screen rates modal.",
      "🏆 Community Leaderboard & User Profiles: Real-time rankings for Most Pulls and Rarest Card score, with clickable profiles showcasing favorited cards and rarest pulls.",
      "⏱️ User Local Timezone: Automatic browser timezone conversion (e.g. UTC+8) for all timestamps across stats, history, announcements, and profiles.",
      "🎁 500 Bonus Pulls Distribution: Distributed 500 free bonus pulls compensation gift to all players post-maintenance."
    ],
    keyPromotions: [
      { artist: "xi", title: "FREEDOM DiVE", fromTier: "GOAT", toTier: "EX", reason: "Historic milestone: osu! standard's first 8★ FC by Cookiezi & undisputed benchmark of speed and stamina." },
      { artist: "The Quick Brown Fox", title: "The Big Black", fromTier: "GOAT", toTier: "EX", reason: "Legendary 2012 monument: The ultimate icon of early high-difficulty competitive osu!." },
      { artist: "Imperial Circus Dead Decadence", title: "Yomi yori Kikoyu, Koukoku no Tou to Honoo no Shoujo.", fromTier: "GOAT", toTier: "EX", reason: "Unrivaled 8.28★ stamina test of human limits mapped by Dokito." }
    ]
  },
  {
    version: "v5.1",
    date: "August 2026",
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
