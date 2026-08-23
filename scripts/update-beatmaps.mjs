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
const TARGET_POOL_SIZE = parseInt(process.env.TARGET_POOL_SIZE || '10000', 10);
const RATE_LIMIT_DELAY_MS = 250;

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

  if (queryParams.genre) {
    url.searchParams.set('g', queryParams.genre);
  }

  if (queryParams.q) {
    url.searchParams.set('q', queryParams.q);
  }

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

/**
 * Calculate popularity score based on total song playcount and favourites.
 */
function calculatePopularity(maps) {
  if (maps.length === 0) return [];

  let minPlayLog = Infinity;
  let maxPlayLog = -Infinity;
  let minFavLog = Infinity;
  let maxFavLog = -Infinity;

  for (const m of maps) {
    if (m.rawPlayLog < minPlayLog) minPlayLog = m.rawPlayLog;
    if (m.rawPlayLog > maxPlayLog) maxPlayLog = m.rawPlayLog;
    if (m.rawFavLog < minFavLog) minFavLog = m.rawFavLog;
    if (m.rawFavLog > maxFavLog) maxFavLog = m.rawFavLog;
  }

  const playRange = maxPlayLog - minPlayLog || 1;
  const favRange = maxFavLog - minFavLog || 1;

  return maps.map((m) => {
    const normPlay = (m.rawPlayLog - minPlayLog) / playRange;
    const normFav = (m.rawFavLog - minFavLog) / favRange;
    const popularityScore = Math.round((0.70 * normPlay + 0.30 * normFav) * 1000) / 10;

    const { rawPlayLog, rawFavLog, ...cleanMap } = m;
    return {
      ...cleanMap,
      popularityScore,
    };
  });
}

/**
 * Assigns rarity tiers to beatmaps based on popularity score & star difficulty.
 */
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
      if (percentile <= 0.20 || m.popularityScore >= 98.5) {
        rarity = 'Divine';
      } else if (percentile <= 1.0 || m.popularityScore >= 95.0) {
        rarity = 'Mythic';
      } else if (percentile <= 5.0 || m.popularityScore >= 88.0) {
        rarity = 'Legendary';
      } else if (percentile <= 16.0 || m.popularityScore >= 75.0) {
        rarity = 'Epic';
      } else if (percentile <= 40.0 || m.popularityScore >= 55.0) {
        rarity = 'Rare';
      } else if (percentile <= 75.0 || m.popularityScore >= 35.0) {
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
  console.log('=== osu! Beatmap Gacha Dataset Updater (10,000 Maps) ===');

  try {
    const token = await getOsuApiToken(CLIENT_ID, CLIENT_SECRET);
    const collectedDifficulties = new Map(); // id -> map

    // 1. Pre-load existing maps if available
    if (fs.existsSync(MAPS_FILE)) {
      try {
        const existing = JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8'));
        if (Array.isArray(existing)) {
          for (const m of existing) {
            collectedDifficulties.set(m.id, {
              ...m,
              rawPlayLog: Math.log10(Math.max(1, m.playcount || 1)),
              rawFavLog: Math.log10(Math.max(1, m.favouriteCount || 1)),
            });
          }
          console.log(`Pre-loaded ${collectedDifficulties.size} existing beatmaps from ${MAPS_FILE}`);
        }
      } catch (err) {
        console.warn('Could not read existing maps.json:', err.message);
      }
    }

    const searchQueries = [
      { status: 'ranked', sort: 'plays_desc' },
      { status: 'ranked', sort: 'favourites_desc' },
      { status: 'ranked', sort: 'ranked_desc' },
      { status: 'loved', sort: 'plays_desc' },
      { status: 'loved', sort: 'favourites_desc' },
      { status: 'ranked', sort: 'difficulty_desc' },
      { status: 'ranked', sort: 'plays_desc', genre: '2' }, // Anime
      { status: 'ranked', sort: 'plays_desc', genre: '3' }, // Video Game
      { status: 'ranked', sort: 'plays_desc', genre: '5' }, // Electronic
      { status: 'ranked', sort: 'plays_desc', genre: '4' }, // Rock
      { status: 'ranked', sort: 'plays_desc', genre: '6' }, // Pop
      { status: 'ranked', sort: 'plays_desc', genre: '7' }, // Novelty
      { status: 'ranked', sort: 'plays_desc', q: 'sotarks' },
      { status: 'ranked', sort: 'plays_desc', q: 'monstrata' },
      { status: 'ranked', sort: 'plays_desc', q: 'xi' },
      { status: 'ranked', sort: 'plays_desc', q: 'camellia' },
      { status: 'ranked', sort: 'plays_desc', q: 'dragonforce' },
      { status: 'ranked', sort: 'plays_desc', q: 'tv size' },
    ];

    console.log(`Fetching top beatmaps to reach ${TARGET_POOL_SIZE} target maps...`);

    for (const q of searchQueries) {
      if (collectedDifficulties.size >= TARGET_POOL_SIZE * 1.1) break;

      let cursor_string = null;
      let pages = 0;
      const maxPages = 40;

      console.log(`\nScanning category: status="${q.status}", sort="${q.sort}" ${q.genre ? `genre=${q.genre}` : ''} ${q.q ? `q=${q.q}` : ''}...`);

      while (pages < maxPages && collectedDifficulties.size < TARGET_POOL_SIZE * 1.15) {
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
          const beatmaps = set.beatmaps || [];
          const setPlaycount = set.play_count || 0;
          const setFavouriteCount = set.favourite_count || 0;

          for (const b of beatmaps) {
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

        console.log(`Page ${pages}: Total unique difficulties collected: ${collectedDifficulties.size}`);
        cursor_string = data.cursor_string;
        if (!cursor_string) break;
      }
    }

    const allDifficulties = Array.from(collectedDifficulties.values());
    console.log(`\nCollected ${allDifficulties.length} total unique difficulties.`);

    // Compute popularity scores based on total song playcount & favourites
    const withScores = calculatePopularity(allDifficulties);

    // Sort descending by popularity
    withScores.sort((a, b) => b.popularityScore - a.popularityScore || b.stars - a.stars);

    // Trim to top pool size (10,000)
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

    console.log(`\n✅ Dataset successfully generated with ${finalDataset.length} maps written to ${MAPS_FILE} and ${SEED_FILE}`);
    console.log('Rarity distribution:', rarityCounts);
  } catch (err) {
    console.error('❌ Failed to update beatmap dataset:', err.message);
    if (fs.existsSync(TEMP_FILE)) {
      try { fs.unlinkSync(TEMP_FILE); } catch {}
    }
  }
}

main();
