#!/usr/bin/env node
/**
 * scripts/update-beatmaps.mjs
 *
 * Automated dataset updater for osu! Beatmap Gacha.
 * Authenticates with osu! API v2 using OAuth client credentials,
 * fetches top ranked & loved beatmaps, normalizes metadata and covers,
 * ranks songs based on total song playcount and favourites,
 * and writes the optimized dataset to public/data/maps.json and src/data/seedData.ts.
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
const TARGET_POOL_SIZE = parseInt(process.env.TARGET_POOL_SIZE || '6000', 10);
const RATE_LIMIT_DELAY_MS = 350; // osu! API rate limit is ~120 requests / min for client credentials

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Authenticates with osu! API v2 using OAuth Client Credentials Grant.
 */
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

/**
 * Fetch beatmapsets from osu! API v2 with pagination and retry backoff.
 */
async function fetchBeatmapsets(token, sort = 'plays_desc', queryParams = {}) {
  const url = new URL('https://osu.ppy.sh/api/v2/beatmapsets/search');
  url.searchParams.set('sort', sort);
  url.searchParams.set('s', queryParams.status || 'ranked');
  url.searchParams.set('m', '0'); // osu! standard

  if (queryParams.cursor_string) {
    url.searchParams.set('cursor_string', queryParams.cursor_string);
  }

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
        console.warn('Rate limited (429). Backing off for 5 seconds...');
        await sleep(5000);
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
      console.warn(`Request failed (${err.message}). Retrying in 2s...`);
      await sleep(2000);
    }
  }
}

/**
 * Normalizes and computes 0 - 100 popularity score from song playcount and favourites.
 */
function calculatePopularity(scored) {
  const minPlayLog = Math.min(...scored.map((s) => s.rawPlayLog));
  const maxPlayLog = Math.max(...scored.map((s) => s.rawPlayLog));
  const minFavLog = Math.min(...scored.map((s) => s.rawFavLog));
  const maxFavLog = Math.max(...scored.map((s) => s.rawFavLog));

  return scored.map((m) => {
    const normPlay = maxPlayLog > minPlayLog ? (m.rawPlayLog - minPlayLog) / (maxPlayLog - minPlayLog) : 0;
    const normFav = maxFavLog > minFavLog ? (m.rawFavLog - minFavLog) / (maxFavLog - minFavLog) : 0;
    const popScore = Math.round((0.70 * normPlay + 0.30 * normFav) * 10000) / 100;

    return {
      ...m,
      popularityScore: popScore,
    };
  });
}

/**
 * Assigns rarity tiers based on song percentiles across the dataset.
 * Specifically assigns GOAT tier to the top 10 unique most played songs!
 */
function assignRarities(sortedMaps) {
  // Identify top 10 unique beatmapsets for GOAT tier
  const seenSets = new Set();
  const goatSetIds = new Set();

  for (const map of sortedMaps) {
    if (!seenSets.has(map.beatmapsetId)) {
      seenSets.add(map.beatmapsetId);
      goatSetIds.add(map.beatmapsetId);
      if (goatSetIds.size >= 10) break;
    }
  }

  // Pick the single highest-difficulty flagship map of each GOAT set to receive the GOAT badge
  const goatMapIds = new Set();
  goatSetIds.forEach((setId) => {
    const diffsInSet = sortedMaps.filter((m) => m.beatmapsetId === setId);
    diffsInSet.sort((a, b) => b.stars - a.stars);
    if (diffsInSet[0]) {
      goatMapIds.add(diffsInSet[0].id);
    }
  });

  // Separate non-goat maps to assign percentiles cleanly
  const nonGoatMaps = sortedMaps.filter((m) => !goatMapIds.has(m.id));
  const nonGoatTotal = nonGoatMaps.length;

  const rarityMap = new Map();
  goatMapIds.forEach((id) => rarityMap.set(id, 'GOAT'));

  nonGoatMaps.forEach((m, idx) => {
    let rarity = 'Common';
    if (idx < Math.round(nonGoatTotal * 0.0010)) {
      rarity = 'Divine'; // Top 0.10%
    } else if (idx < Math.round(nonGoatTotal * 0.0035)) {
      rarity = 'Mythic'; // Top 0.25%
    } else if (idx < Math.round(nonGoatTotal * 0.0135)) {
      rarity = 'Legendary'; // Top 1.00%
    } else if (idx < Math.round(nonGoatTotal * 0.0735)) {
      rarity = 'Epic'; // Top 6.00%
    } else if (idx < Math.round(nonGoatTotal * 0.2535)) {
      rarity = 'Rare'; // Top 18.00%
    } else if (idx < Math.round(nonGoatTotal * 0.6000)) {
      rarity = 'Uncommon'; // Top 34.65%
    } else {
      rarity = 'Common'; // Remaining 40.0%
    }
    rarityMap.set(m.id, rarity);
  });

  return sortedMaps.map((m) => ({
    id: m.id,
    beatmapsetId: m.beatmapsetId,
    artist: m.artist,
    artistUnicode: m.artistUnicode || m.artist,
    title: m.title,
    titleUnicode: m.titleUnicode || m.title,
    version: m.version,
    creator: m.creator,
    stars: m.stars,
    bpm: m.bpm,
    length: m.length,
    status: m.status,
    playcount: m.playcount,
    favouriteCount: m.favouriteCount,
    rankedDate: m.rankedDate,
    covers: m.covers,
    previewUrl: m.previewUrl,
    rarity: rarityMap.get(m.id) || 'Common',
    popularityScore: m.popularityScore,
    mode: 0,
  }));
}

/**
 * Validates the generated dataset structure before replacing production file.
 */
function validateDataset(maps) {
  if (!Array.isArray(maps) || maps.length < 50) {
    throw new Error(`Dataset validation failed: Expected at least 50 maps, got ${maps?.length}`);
  }

  const requiredFields = ['id', 'beatmapsetId', 'artist', 'title', 'version', 'creator', 'stars', 'bpm', 'length', 'rarity', 'popularityScore', 'covers'];

  for (let i = 0; i < Math.min(maps.length, 50); i++) {
    const map = maps[i];
    for (const field of requiredFields) {
      if (map[field] === undefined || map[field] === null) {
        throw new Error(`Map #${map.id || i} is missing required field "${field}"`);
      }
    }
  }

  console.log(`Validation passed: ${maps.length} valid beatmap difficulties.`);
  return true;
}

/**
 * Main update routine.
 */
async function main() {
  console.log('=== osu! Beatmap Gacha Dataset Updater ===');

  try {
    const token = await getOsuApiToken(CLIENT_ID, CLIENT_SECRET);

    const collectedDifficulties = new Map(); // id -> map
    const searchSorts = ['plays_desc', 'favourites_desc', 'ranked_desc'];
    const statuses = ['ranked', 'loved'];

    console.log(`Fetching top beatmaps (Target pool: ~${TARGET_POOL_SIZE} difficulties)...`);

    for (const status of statuses) {
      for (const sort of searchSorts) {
        if (collectedDifficulties.size >= TARGET_POOL_SIZE) break;

        let cursor_string = null;
        let pages = 0;
        const maxPagesPerCategory = 50; // Up to 50 pages (2500 beatmapsets) per category

        console.log(`\nScanning category: status="${status}", sort="${sort}"...`);

        while (pages < maxPagesPerCategory && collectedDifficulties.size < TARGET_POOL_SIZE * 1.3) {
          pages++;
          const data = await fetchBeatmapsets(token, sort, { status, cursor_string });
          const sets = data?.beatmapsets || [];

          if (sets.length === 0) break;

          for (const set of sets) {
            const beatmaps = set.beatmaps || [];
            const setPlaycount = set.play_count || 0;
            const setFavouriteCount = set.favourite_count || 0;

            for (const b of beatmaps) {
              // Filter to osu!standard (mode 0) and positive star rating
              if (b.mode_int !== 0 && b.mode !== 'osu') continue;
              if (b.difficulty_rating <= 0) continue;

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
                rawPlayLog: Math.log10(Math.max(1, setPlaycount || b.playcount || 0)),
                rawFavLog: Math.log10(Math.max(1, setFavouriteCount)),
              };

              collectedDifficulties.set(b.id, mapDifficulty);
            }
          }

          cursor_string = data.cursor_string;
          if (!cursor_string) break;
        }
      }
    }

    const allDifficulties = Array.from(collectedDifficulties.values());
    console.log(`\nCollected ${allDifficulties.length} total unique difficulties.`);

    // Compute popularity scores based on total song playcount & favourites
    const withScores = calculatePopularity(allDifficulties);

    // Sort descending by popularity
    withScores.sort((a, b) => b.popularityScore - a.popularityScore || b.stars - a.stars);

    // Trim to top pool size
    const topPool = withScores.slice(0, TARGET_POOL_SIZE);

    // Assign rarity tiers based on percentiles
    const finalDataset = assignRarities(topPool);

    // Validate dataset
    validateDataset(finalDataset);

    // Write atomic temp file
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
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      totalMaps: finalDataset.length,
      rarityCounts,
      source: 'osu! API v2 Live Generation',
    };

    // Atomically replace maps.json and update dataset-info.json
    fs.renameSync(TEMP_FILE, MAPS_FILE);
    fs.writeFileSync(INFO_FILE, JSON.stringify(datasetInfo, null, 2));

    // Also update seedData.ts with top 1,500 maps
    const seedSubset = finalDataset.slice(0, 1500);
    const seedContent = `import { Beatmap, DatasetInfo } from '../types/beatmap';\n\nexport const SEED_DATASET_INFO: DatasetInfo = ${JSON.stringify(datasetInfo, null, 2)};\n\nexport const SEED_BEATMAPS: Beatmap[] = ${JSON.stringify(seedSubset, null, 2)};\n`;
    fs.writeFileSync(SEED_FILE, seedContent);

    console.log(`\n✅ Dataset successfully generated and written to ${MAPS_FILE} and ${SEED_FILE}`);
    console.log('Rarity distribution:', rarityCounts);
  } catch (err) {
    console.error('❌ Failed to update beatmap dataset:', err.message);
    if (fs.existsSync(TEMP_FILE)) {
      try { fs.unlinkSync(TEMP_FILE); } catch {}
    }
  }
}

main();
