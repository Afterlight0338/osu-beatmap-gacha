#!/usr/bin/env node
/**
 * scripts/build-era-pool.mjs
 *
 * Expands the osu! Beatmap Gacha pool with a dedicated 5,000-map Era Pool (2019–present).
 *
 * Pool Structure:
 * - 10,000 Global Top Maps (Existing all-time pool preserved)
 * +  5,000 Era Maps (2019–present, distributed across release years)
 * = 15,000 Unique Beatmaps
 *
 * Rules:
 * - Cover maps released from 2019 onward.
 * - Select most popular eligible maps from each release year (playcount + favourites).
 * - Distribute slots across years using a configurable allocation table.
 * - Deduplicate by beatmap ID; Top 10k maps do not consume Era Pool slots.
 * - Dynamic redistribution ensures exactly 5,000 Era maps are collected.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAPS_FILE = path.resolve(__dirname, '../public/data/maps.json');
const INFO_FILE = path.resolve(__dirname, '../public/data/dataset-info.json');
const SEED_FILE = path.resolve(__dirname, '../src/data/seedData.ts');
const TEMP_FILE = path.resolve(__dirname, '../public/data/maps.tmp.json');

const CLIENT_ID = process.env.OSU_CLIENT_ID || '64407';
const CLIENT_SECRET = process.env.OSU_CLIENT_SECRET || 'iB3705wFfBMOmDMySfVftLC9pULUYtd9aOYcWIDI';
const RATE_LIMIT_DELAY_MS = 250;

/**
 * Configurable Yearly Allocation for the 5,000 Era Pool slots.
 * Can be tuned or adjusted as newer years expand.
 */
export const ERA_CONFIG = {
  startYear: 2019,
  targetEraSize: 5000,
  yearlyAllocation: {
    2019: 650,
    2020: 650,
    2021: 700,
    2022: 750,
    2023: 750,
    2024: 750,
    2025: 550,
    2026: 200,
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOsuApiToken(clientId, clientSecret) {
  console.log('Authenticating with osu! API v2...');
  const res = await fetch('https://osu.ppy.sh/oauth/token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: parseInt(clientId, 10),
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'public',
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`osu! OAuth failed with HTTP ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  console.log('osu! API authentication successful.');
  return data.access_token;
}

async function fetchBeatmapsets(token, sort = 'plays_desc', queryParams = {}) {
  const url = new URL('https://osu.ppy.sh/api/v2/beatmapsets/search');
  url.searchParams.set('sort', sort);
  url.searchParams.set('s', queryParams.status || 'ranked');
  url.searchParams.set('m', '0'); // osu! standard

  if (queryParams.genre) url.searchParams.set('g', queryParams.genre);
  if (queryParams.q) url.searchParams.set('q', queryParams.q);
  if (queryParams.cursor_string) url.searchParams.set('cursor_string', queryParams.cursor_string);

  let retries = 3;
  while (retries > 0) {
    try {
      await sleep(RATE_LIMIT_DELAY_MS);
      const res = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 429) {
        console.warn('Rate limited (429). Backing off for 4 seconds...');
        await sleep(4000);
        retries--;
        continue;
      }

      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}: ${await res.text()}`);
      }

      return await res.json();
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      await sleep(1500);
    }
  }
}

function calculatePopularity(maps) {
  if (maps.length === 0) return [];

  let minPlayLog = Infinity;
  let maxPlayLog = -Infinity;
  let minFavLog = Infinity;
  let maxFavLog = -Infinity;

  for (const m of maps) {
    const playLog = Math.log10(Math.max(1, m.playcount || 1));
    const favLog = Math.log10(Math.max(1, m.favouriteCount || 1));
    if (playLog < minPlayLog) minPlayLog = playLog;
    if (playLog > maxPlayLog) maxPlayLog = playLog;
    if (favLog < minFavLog) minFavLog = favLog;
    if (favLog > maxFavLog) maxFavLog = favLog;
  }

  const playRange = maxPlayLog - minPlayLog || 1;
  const favRange = maxFavLog - minFavLog || 1;

  return maps.map((m) => {
    const playLog = Math.log10(Math.max(1, m.playcount || 1));
    const favLog = Math.log10(Math.max(1, m.favouriteCount || 1));
    const normPlay = (playLog - minPlayLog) / playRange;
    const normFav = (favLog - minFavLog) / favRange;
    const popularityScore = Math.round((0.70 * normPlay + 0.30 * normFav) * 1000) / 10;

    return {
      ...m,
      popularityScore,
    };
  });
}

function assignRarities(maps) {
  const sorted = [...maps].sort((a, b) => b.popularityScore - a.popularityScore || b.stars - a.stars);
  const total = sorted.length;

  const goatSets = new Set();
  const goatMapIds = new Set();

  for (const m of sorted) {
    if (!goatSets.has(m.beatmapsetId) && goatSets.size < 10) {
      goatSets.add(m.beatmapsetId);
      goatMapIds.add(m.id);
    }
  }

  return sorted.map((m, index) => {
    let rarity = 'Common';

    if (goatMapIds.has(m.id)) {
      rarity = 'GOAT';
    } else {
      const percentile = (index / total) * 100;
      if (percentile <= 0.15 || m.popularityScore >= 98.5) {
        rarity = 'Divine';
      } else if (percentile <= 0.80 || m.popularityScore >= 95.0) {
        rarity = 'Mythic';
      } else if (percentile <= 4.0 || m.popularityScore >= 88.0) {
        rarity = 'Legendary';
      } else if (percentile <= 14.0 || m.popularityScore >= 75.0) {
        rarity = 'Epic';
      } else if (percentile <= 36.0 || m.popularityScore >= 55.0) {
        rarity = 'Rare';
      } else if (percentile <= 70.0 || m.popularityScore >= 35.0) {
        rarity = 'Uncommon';
      } else {
        rarity = 'Common';
      }
    }

    return {
      ...m,
      rarity,
    };
  });
}

async function main() {
  console.log('=== osu! Beatmap Gacha: Top 10,000 + 5,000 Era Pool Generator ===');

  if (!fs.existsSync(MAPS_FILE)) {
    throw new Error(`Base maps file not found at ${MAPS_FILE}.`);
  }

  // 1. Load the existing Top 10,000 Global Maps
  const rawBase = JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8'));
  const top10kMaps = rawBase.slice(0, 10000);
  const top10kIds = new Set(top10kMaps.map((m) => m.id));

  console.log(`Loaded ${top10kMaps.length} existing Top 10k Global beatmaps.`);

  const token = await getOsuApiToken(CLIENT_ID, CLIENT_SECRET);

  // 2. Collect Era candidate beatmaps (2019–present)
  const candidatePoolByYear = new Map(); // year -> Map<id, map>
  for (let y = ERA_CONFIG.startYear; y <= 2026; y++) {
    candidatePoolByYear.set(y, new Map());
  }

  // Also index any 2019+ maps in the raw file that weren't in top10k (if any)
  if (rawBase.length > 10000) {
    for (const m of rawBase.slice(10000)) {
      if (m.rankedDate && !top10kIds.has(m.id)) {
        const y = new Date(m.rankedDate).getFullYear();
        if (candidatePoolByYear.has(y)) {
          candidatePoolByYear.get(y).set(m.id, m);
        }
      }
    }
  }

  const queries = [
    { status: 'ranked', sort: 'ranked_desc' },
    { status: 'ranked', sort: 'plays_desc', genre: '2' }, // Anime
    { status: 'ranked', sort: 'plays_desc', genre: '3' }, // Video Game
    { status: 'ranked', sort: 'plays_desc', genre: '5' }, // Electronic
    { status: 'ranked', sort: 'plays_desc', genre: '4' }, // Rock
    { status: 'ranked', sort: 'plays_desc', genre: '6' }, // Pop
    { status: 'loved', sort: 'ranked_desc' },
    { status: 'ranked', sort: 'favourites_desc' },
    { status: 'ranked', sort: 'plays_desc', q: '2024' },
    { status: 'ranked', sort: 'plays_desc', q: '2023' },
    { status: 'ranked', sort: 'plays_desc', q: '2022' },
    { status: 'ranked', sort: 'plays_desc', q: '2021' },
    { status: 'ranked', sort: 'plays_desc', q: '2020' },
    { status: 'ranked', sort: 'plays_desc', q: '2019' },
    { status: 'ranked', sort: 'ranked_desc', q: 'sotarks' },
    { status: 'ranked', sort: 'ranked_desc', q: 'browiec' },
    { status: 'ranked', sort: 'ranked_desc', q: 'reform' },
    { status: 'ranked', sort: 'ranked_desc', q: 'log off now' },
    { status: 'ranked', sort: 'ranked_desc', q: 'camellia' },
  ];

  console.log('\nScanning for 2019–2026 Era beatmaps from osu! API v2...');

  for (const q of queries) {
    let totalCollectedInEra = 0;
    for (const yearMaps of candidatePoolByYear.values()) {
      totalCollectedInEra += yearMaps.size;
    }

    if (totalCollectedInEra >= ERA_CONFIG.targetEraSize * 2) {
      console.log(`\nCollected ${totalCollectedInEra} Era candidates. Proceeding to allocation.`);
      break;
    }

    let cursor_string = null;
    let pages = 0;
    const maxPages = 35;

    console.log(`\nScanning category: status="${q.status}", sort="${q.sort}" ${q.genre ? `genre=${q.genre}` : ''} ${q.q ? `q=${q.q}` : ''}...`);

    while (pages < maxPages) {
      pages++;
      const data = await fetchBeatmapsets(token, q.sort, {
        status: q.status,
        genre: q.genre,
        q: q.q,
        cursor_string,
      });

      const sets = data?.beatmapsets || [];
      if (sets.length === 0) break;

      for (const set of sets) {
        if (!set.ranked_date) continue;
        const year = new Date(set.ranked_date).getFullYear();
        if (year < ERA_CONFIG.startYear || year > 2026) continue;

        const setPlaycount = set.play_count || 0;
        const setFavouriteCount = set.favourite_count || 0;

        for (const b of set.beatmaps || []) {
          if (b.mode_int !== 0 && b.mode !== 'osu') continue;
          if (b.difficulty_rating <= 0) continue;
          if (top10kIds.has(b.id)) continue; // Must not consume slot if already in Top 10k

          const mapDifficulty = {
            id: b.id,
            beatmapsetId: set.id,
            artist: set.artist,
            artistUnicode: set.artist_unicode || set.artist,
            title: set.title,
            titleUnicode: set.title_unicode || set.title,
            version: b.version,
            creator: set.creator,
            creatorId: set.user_id,
            stars: Math.round(b.difficulty_rating * 100) / 100,
            bpm: Math.round(b.bpm || set.bpm || 120),
            length: b.total_length || b.hit_length || 0,
            status: b.status || set.status,
            playcount: setPlaycount || b.playcount || 0,
            favouriteCount: setFavouriteCount,
            rankedDate: set.ranked_date,
            covers: {
              cover: set.covers?.cover || `https://assets.ppy.sh/beatmaps/${set.id}/covers/cover.jpg`,
              card: set.covers?.card || `https://assets.ppy.sh/beatmaps/${set.id}/covers/card.jpg`,
              list: set.covers?.list || `https://assets.ppy.sh/beatmaps/${set.id}/covers/list.jpg`,
              slimcover: set.covers?.slimcover || `https://assets.ppy.sh/beatmaps/${set.id}/covers/slimcover.jpg`,
            },
            previewUrl: `https://b.ppy.sh/preview/${set.id}.mp3`,
          };

          candidatePoolByYear.get(year).set(b.id, mapDifficulty);
        }
      }

      cursor_string = data.cursor_string;
      if (!cursor_string) break;
    }
  }

  // 3. Score and select top maps per year based on configured allocation
  console.log('\n--- Candidate Pool per Release Year (2019–present) ---');
  for (const [year, mapsMap] of candidatePoolByYear.entries()) {
    console.log(`Year ${year}: ${mapsMap.size} eligible candidates`);
  }

  const selectedEraMaps = [];
  const selectedEraIds = new Set();
  let remainingSlotsNeeded = ERA_CONFIG.targetEraSize;
  const remainingCandidatesByYear = new Map();

  // Phase 1: Allocate according to ERA_CONFIG.yearlyAllocation
  for (const [yearStr, quota] of Object.entries(ERA_CONFIG.yearlyAllocation)) {
    const year = parseInt(yearStr, 10);
    const candidates = Array.from(candidatePoolByYear.get(year)?.values() || []);

    // Score candidates by popularity (playcount & favourites)
    const scored = calculatePopularity(candidates);
    scored.sort((a, b) => b.popularityScore - a.popularityScore || b.stars - a.stars);

    const taken = scored.slice(0, quota);
    taken.forEach((m) => {
      selectedEraMaps.push(m);
      selectedEraIds.add(m.id);
    });

    remainingCandidatesByYear.set(year, scored.slice(quota));
    remainingSlotsNeeded -= taken.length;

    console.log(`Allocated Year ${year}: ${taken.length} / ${quota} quota filled.`);
  }

  // Phase 2: Dynamic Re-balancing if any year was underfilled
  if (remainingSlotsNeeded > 0) {
    console.log(`\nRe-balancing remaining ${remainingSlotsNeeded} slots across available surplus candidates...`);
    const allRemaining = [];
    for (const remList of remainingCandidatesByYear.values()) {
      for (const m of remList) {
        if (!selectedEraIds.has(m.id)) {
          allRemaining.push(m);
        }
      }
    }

    allRemaining.sort((a, b) => b.popularityScore - a.popularityScore || b.stars - a.stars);
    const extra = allRemaining.slice(0, remainingSlotsNeeded);
    extra.forEach((m) => {
      selectedEraMaps.push(m);
      selectedEraIds.add(m.id);
    });
    console.log(`Added ${extra.length} surplus candidates from modern eras.`);
  }

  console.log(`\nTotal Era Pool (2019–present) selected: ${selectedEraMaps.length} maps.`);

  // 4. Combine: 10,000 Global Top Maps + 5,000 Era Pool Maps = 15,000 Unique Maps
  const combinedRaw = [...top10kMaps, ...selectedEraMaps];

  // Final deduplication check
  const finalMapById = new Map();
  for (const m of combinedRaw) {
    if (!finalMapById.has(m.id)) {
      finalMapById.set(m.id, m);
    }
  }

  const finalPool = Array.from(finalMapById.values());
  console.log(`Combined final unique pool size: ${finalPool.length} maps.`);

  // Re-compute popularity scores and assign 8 rarity tiers
  const withScores = calculatePopularity(finalPool);
  const finalDataset = assignRarities(withScores);

  // 5. Write to maps.json and seedData.ts
  fs.mkdirSync(path.dirname(MAPS_FILE), { recursive: true });
  fs.writeFileSync(TEMP_FILE, JSON.stringify(finalDataset, null, 2));

  const rarityCounts = {
    Common: 0,
    Uncommon: 0,
    Rare: 0,
    Epic: 0,
    Legendary: 0,
    Mythic: 0,
    Divine: 0,
    GOAT: 0,
  };

  finalDataset.forEach((m) => {
    rarityCounts[m.rarity] = (rarityCounts[m.rarity] || 0) + 1;
  });

  const datasetInfo = {
    version: '1.2.0',
    lastUpdated: new Date().toISOString(),
    totalMaps: finalDataset.length,
    poolComposition: {
      globalTopMaps: top10kMaps.length,
      eraPoolMaps: selectedEraMaps.length,
      eraStartYear: ERA_CONFIG.startYear,
    },
    rarityCounts,
    source: 'osu! API v2 Global Top 10k + 5k Era Pool (2019–present)',
  };

  fs.renameSync(TEMP_FILE, MAPS_FILE);
  fs.writeFileSync(INFO_FILE, JSON.stringify(datasetInfo, null, 2));

  // Update seedData.ts with top 1,500 maps
  const seedSubset = finalDataset.slice(0, 1500);
  const seedContent = `import { Beatmap, DatasetInfo } from '../types/beatmap';\n\nexport const SEED_DATASET_INFO: DatasetInfo = ${JSON.stringify(datasetInfo, null, 2)};\n\nexport const SEED_BEATMAPS: Beatmap[] = ${JSON.stringify(seedSubset, null, 2)};\n`;
  fs.writeFileSync(SEED_FILE, seedContent);

  console.log(`\n🎉 Success! Generated ${finalDataset.length} maps written to ${MAPS_FILE} and ${SEED_FILE}`);
  console.log('Rarity distribution:', rarityCounts);
  console.log('Dataset Info:', datasetInfo);
}

main().catch((err) => {
  console.error('❌ Failed to build Era Pool dataset:', err);
  if (fs.existsSync(TEMP_FILE)) {
    try { fs.unlinkSync(TEMP_FILE); } catch {}
  }
  process.exit(1);
});
