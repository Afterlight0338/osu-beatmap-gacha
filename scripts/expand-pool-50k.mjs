#!/usr/bin/env node
/**
 * scripts/expand-pool-50k.mjs
 *
 * Expands the osu! Beatmap Gacha pool to 50,000 unique ranked & loved beatmaps.
 * Strict Pyramidical Rarity Hierarchy:
 * Common (19,690) > Uncommon (17,000) > Rare (9,000) > Epic (3,000) > Legendary (1,000) > Mythic (250) > Divine (50) > GOAT (10)
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

const CLIENT_ID = process.env.OSU_CLIENT_ID;
const CLIENT_SECRET = process.env.OSU_CLIENT_SECRET;
const TARGET_POOL_SIZE = parseInt(process.env.TARGET_POOL_SIZE || '50000', 10);
const RATE_LIMIT_DELAY_MS = 180;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: Please set OSU_CLIENT_ID and OSU_CLIENT_SECRET environment variables.');
  process.exit(1);
}

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
  if (queryParams.language) url.searchParams.set('l', queryParams.language);
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

/**
 * Strict Pyramidical Rarity Hierarchy for 50,000 Maps:
 * GOAT: Top 10 Landmark Mapsets (10 maps)
 * Divine: Top 0.10% (50 maps)
 * Mythic: Top 0.60% (250 maps)
 * Legendary: Top 2.60% (1,000 maps)
 * Epic: Top 8.60% (3,000 maps)
 * Rare: Top 26.60% (9,000 maps)
 * Uncommon: Top 60.60% (17,000 maps)
 * Common: Remaining 39.40% (19,690 maps)
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
      if (percentile <= 0.10) {
        rarity = 'Divine';
      } else if (percentile <= 0.60) {
        rarity = 'Mythic';
      } else if (percentile <= 2.60) {
        rarity = 'Legendary';
      } else if (percentile <= 8.60) {
        rarity = 'Epic';
      } else if (percentile <= 26.60) {
        rarity = 'Rare';
      } else if (percentile <= 60.60) {
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
  if (!Array.isArray(maps) || maps.length < 1000) {
    throw new Error(`Dataset validation failed: Expected at least 1000 maps, got ${maps?.length}`);
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

async function main() {
  console.log('=== osu! Beatmap Gacha: 50,000 Maps Dataset Generator ===');

  const collectedDifficulties = new Map(); // id -> map

  // 1. Pre-load existing maps (25,000)
  if (fs.existsSync(MAPS_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8'));
      if (Array.isArray(existing)) {
        for (const m of existing) {
          collectedDifficulties.set(m.id, m);
        }
        console.log(`Pre-loaded ${collectedDifficulties.size} existing beatmaps from ${MAPS_FILE}`);
      }
    } catch (err) {
      console.warn('Could not read existing maps.json:', err.message);
    }
  }

  const token = await getOsuApiToken(CLIENT_ID, CLIENT_SECRET);

  const searchQueries = [
    // Statuses & General Sorts
    { status: 'ranked', sort: 'plays_desc' },
    { status: 'ranked', sort: 'favourites_desc' },
    { status: 'ranked', sort: 'ranked_desc' },
    { status: 'ranked', sort: 'difficulty_desc' },
    { status: 'loved', sort: 'plays_desc' },
    { status: 'loved', sort: 'favourites_desc' },
    { status: 'loved', sort: 'ranked_desc' },
    { status: 'loved', sort: 'difficulty_desc' },

    // Genres
    { status: 'ranked', sort: 'ranked_desc', genre: '2' },  // Anime
    { status: 'ranked', sort: 'ranked_desc', genre: '3' },  // Video Game
    { status: 'ranked', sort: 'ranked_desc', genre: '4' },  // Rock
    { status: 'ranked', sort: 'ranked_desc', genre: '5' },  // Pop
    { status: 'ranked', sort: 'ranked_desc', genre: '6' },  // Other
    { status: 'ranked', sort: 'ranked_desc', genre: '7' },  // Novelty
    { status: 'ranked', sort: 'ranked_desc', genre: '9' },  // Hip Hop
    { status: 'ranked', sort: 'ranked_desc', genre: '10' }, // Electronic
    { status: 'ranked', sort: 'ranked_desc', genre: '11' }, // Metal
    { status: 'ranked', sort: 'ranked_desc', genre: '12' }, // Classical
    { status: 'ranked', sort: 'ranked_desc', genre: '13' }, // Folk
    { status: 'ranked', sort: 'ranked_desc', genre: '14' }, // Jazz

    // Languages
    { status: 'ranked', sort: 'ranked_desc', language: '2' }, // English
    { status: 'ranked', sort: 'ranked_desc', language: '3' }, // Japanese
    { status: 'ranked', sort: 'ranked_desc', language: '4' }, // Chinese
    { status: 'ranked', sort: 'ranked_desc', language: '5' }, // Instrumental
    { status: 'ranked', sort: 'ranked_desc', language: '6' }, // Korean
    { status: 'ranked', sort: 'ranked_desc', language: '7' }, // French
    { status: 'ranked', sort: 'ranked_desc', language: '8' }, // German
    { status: 'ranked', sort: 'ranked_desc', language: '9' }, // Swedish
    { status: 'ranked', sort: 'ranked_desc', language: '10' }, // Spanish
    { status: 'ranked', sort: 'ranked_desc', language: '11' }, // Italian
    { status: 'ranked', sort: 'ranked_desc', language: '12' }, // Russian
    { status: 'ranked', sort: 'ranked_desc', language: '13' }, // Polish

    // Specific release years across history
    { status: 'ranked', sort: 'ranked_desc', q: '2026' },
    { status: 'ranked', sort: 'ranked_desc', q: '2025' },
    { status: 'ranked', sort: 'ranked_desc', q: '2024' },
    { status: 'ranked', sort: 'ranked_desc', q: '2023' },
    { status: 'ranked', sort: 'ranked_desc', q: '2022' },
    { status: 'ranked', sort: 'ranked_desc', q: '2021' },
    { status: 'ranked', sort: 'ranked_desc', q: '2020' },
    { status: 'ranked', sort: 'ranked_desc', q: '2019' },
    { status: 'ranked', sort: 'ranked_desc', q: '2018' },
    { status: 'ranked', sort: 'ranked_desc', q: '2017' },
    { status: 'ranked', sort: 'ranked_desc', q: '2016' },
    { status: 'ranked', sort: 'ranked_desc', q: '2015' },
    { status: 'ranked', sort: 'ranked_desc', q: '2014' },
    { status: 'ranked', sort: 'ranked_desc', q: '2013' },
    { status: 'ranked', sort: 'ranked_desc', q: '2012' },
    { status: 'ranked', sort: 'ranked_desc', q: '2011' },
    { status: 'ranked', sort: 'ranked_desc', q: '2010' },
    { status: 'ranked', sort: 'ranked_desc', q: '2009' },
    { status: 'ranked', sort: 'ranked_desc', q: '2008' },

    // Legendary Artists & Mappers
    { status: 'ranked', sort: 'ranked_desc', q: 'camellia' },
    { status: 'ranked', sort: 'ranked_desc', q: 'xi' },
    { status: 'ranked', sort: 'ranked_desc', q: 'dragonforce' },
    { status: 'ranked', sort: 'ranked_desc', q: 'sotarks' },
    { status: 'ranked', sort: 'ranked_desc', q: 'browiec' },
    { status: 'ranked', sort: 'ranked_desc', q: 'reform' },
    { status: 'ranked', sort: 'ranked_desc', q: 'log off now' },
    { status: 'ranked', sort: 'ranked_desc', q: 'nevo' },
    { status: 'ranked', sort: 'ranked_desc', q: 'monstrata' },
    { status: 'ranked', sort: 'ranked_desc', q: 'taeyang' },
    { status: 'ranked', sort: 'ranked_desc', q: 'kroytz' },
    { status: 'ranked', sort: 'ranked_desc', q: 'fieryrage' },
    { status: 'ranked', sort: 'ranked_desc', q: 'akitoshi' },
    { status: 'ranked', sort: 'ranked_desc', q: 'deviouspanda' },
    { status: 'ranked', sort: 'ranked_desc', q: 'smokelind' },
    { status: 'ranked', sort: 'ranked_desc', q: 'leaf' },
    { status: 'ranked', sort: 'ranked_desc', q: 'undead corporation' },
    { status: 'ranked', sort: 'ranked_desc', q: 'tatsh' },
    { status: 'ranked', sort: 'ranked_desc', q: 'lapix' },
    { status: 'ranked', sort: 'ranked_desc', q: 't+pazolite' },
    { status: 'ranked', sort: 'ranked_desc', q: 'usao' },
    { status: 'ranked', sort: 'ranked_desc', q: 'goreshit' },
    { status: 'ranked', sort: 'ranked_desc', q: 'lorna shore' },
    { status: 'ranked', sort: 'ranked_desc', q: 'demetori' },
    { status: 'ranked', sort: 'ranked_desc', q: 'renard' },
    { status: 'ranked', sort: 'ranked_desc', q: 'kurokotei' },
    { status: 'ranked', sort: 'ranked_desc', q: 'sunless rise' },
    { status: 'ranked', sort: 'ranked_desc', q: 'archspire' },
    { status: 'ranked', sort: 'ranked_desc', q: 'hololive' },
    { status: 'ranked', sort: 'ranked_desc', q: 'touhou' },
    { status: 'ranked', sort: 'ranked_desc', q: 'vocaloid' },
    { status: 'ranked', sort: 'ranked_desc', q: 'hatsune miku' },
    { status: 'ranked', sort: 'ranked_desc', q: 'yoasobi' },
    { status: 'ranked', sort: 'ranked_desc', q: 'zuttomo' },
    { status: 'ranked', sort: 'ranked_desc', q: 'minami' },
    { status: 'ranked', sort: 'ranked_desc', q: 'kessoku band' },
    { status: 'ranked', sort: 'ranked_desc', q: 'ado' },
    { status: 'ranked', sort: 'ranked_desc', q: 'eve' },
    { status: 'ranked', sort: 'ranked_desc', q: 'zutomayo' },
    { status: 'ranked', sort: 'ranked_desc', q: 'osu' },
  ];

  console.log(`\nFetching additional beatmaps to reach target ${TARGET_POOL_SIZE} maps...`);

  for (const q of searchQueries) {
    if (collectedDifficulties.size >= TARGET_POOL_SIZE * 1.03) {
      console.log(`\nReached target difficulty count (${collectedDifficulties.size}). Finalizing pool.`);
      break;
    }

    let cursor_string = null;
    let pages = 0;
    const maxPages = 45;

    console.log(`\nScanning category: status="${q.status}", sort="${q.sort}" ${q.genre ? `genre=${q.genre}` : ''} ${q.language ? `lang=${q.language}` : ''} ${q.q ? `q=${q.q}` : ''}...`);

    while (pages < maxPages && collectedDifficulties.size < TARGET_POOL_SIZE * 1.05) {
      pages++;
      const data = await fetchBeatmapsets(token, q.sort, {
        status: q.status,
        genre: q.genre,
        language: q.language,
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

  // Trim to top 50,000 pool
  const topPool = withScores.slice(0, TARGET_POOL_SIZE);

  // Assign strict pyramidical rarity tiers
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
    version: '3.0.0',
    lastUpdated: new Date().toISOString(),
    totalMaps: finalDataset.length,
    rarityCounts,
    source: 'osu! API v2 Live 50,000 Pool Generation',
  };

  // Atomically replace maps.json and update dataset-info.json
  fs.renameSync(TEMP_FILE, MAPS_FILE);
  fs.writeFileSync(INFO_FILE, JSON.stringify(datasetInfo, null, 2));

  // Update seedData.ts with top 500 maps
  const seedSubset = finalDataset.slice(0, 500);
  const seedContent = `import { Beatmap, DatasetInfo } from '../types/beatmap';\n\nexport const SEED_DATASET_INFO: DatasetInfo = ${JSON.stringify(datasetInfo, null, 2)};\n\nexport const SEED_BEATMAPS: Beatmap[] = (${JSON.stringify(seedSubset, null, 2)}) as Beatmap[];\n`;
  fs.writeFileSync(SEED_FILE, seedContent);

  console.log(`\n🎉 Success! Generated ${finalDataset.length} maps written to ${MAPS_FILE} and ${SEED_FILE}`);
  console.log('Pyramidical Rarity Distribution for 50,000 Maps:', rarityCounts);
}

main().catch((err) => {
  console.error('❌ Failed to update dataset:', err);
  if (fs.existsSync(TEMP_FILE)) {
    try { fs.unlinkSync(TEMP_FILE); } catch {}
  }
  process.exit(1);
});
