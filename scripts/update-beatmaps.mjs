/**
 * osu! Beatmap Gacha - Top 10,000 Dataset Updater
 *
 * This script connects to osu! API v2, fetches top ranked and loved beatmapsets,
 * calculates log-normalized popularity scores, assigns rarity tiers, and
 * atomically outputs public/data/maps.json and public/data/dataset-info.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../public/data');
const MAPS_FILE = path.join(DATA_DIR, 'maps.json');
const INFO_FILE = path.join(DATA_DIR, 'dataset-info.json');
const TEMP_FILE = path.join(DATA_DIR, '.temp_maps.json');

const CLIENT_ID = process.env.OSU_CLIENT_ID;
const CLIENT_SECRET = process.env.OSU_CLIENT_SECRET;
const TARGET_POOL_SIZE = parseInt(process.env.TARGET_POOL_SIZE || '10000', 10);

const RATE_LIMIT_DELAY_MS = 300; // Pacing between API requests

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Obtain OAuth2 client credentials token from osu! API v2.
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
 * Normalizes and computes 0 - 100 popularity score from playcount and favourites.
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
 * Assigns rarity tiers based on percentiles across the dataset.
 */
function assignRarities(sortedMaps) {
  const total = sortedMaps.length;

  return sortedMaps.map((m, index) => {
    const percentile = (total - index) / total;

    let rarity = 'Common';
    if (percentile >= 0.9985) rarity = 'Divine';     // Top 0.15%
    else if (percentile >= 0.9920) rarity = 'Mythic'; // Top 0.8%
    else if (percentile >= 0.9700) rarity = 'Legendary'; // Top 3%
    else if (percentile >= 0.9000) rarity = 'Epic';       // Top 10%
    else if (percentile >= 0.7500) rarity = 'Rare';       // Top 25%
    else if (percentile >= 0.5000) rarity = 'Uncommon';   // Top 50%
    else rarity = 'Common';

    return {
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
      rarity,
      popularityScore: m.popularityScore,
      mode: 0,
    };
  });
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
 * Main execution flow.
 */
async function main() {
  console.log('=== osu! Beatmap Gacha Dataset Updater ===');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn('OSU_CLIENT_ID and/or OSU_CLIENT_SECRET are not set in environment.');
    console.log('Checking existing dataset...');

    if (fs.existsSync(MAPS_FILE)) {
      const existing = JSON.parse(fs.readFileSync(MAPS_FILE, 'utf-8'));
      validateDataset(existing);
      console.log(`Existing dataset is healthy (${existing.length} beatmaps). No update performed.`);
      return;
    } else {
      console.log('No existing dataset found. Generating default seed dataset...');
      const demoScript = path.resolve(__dirname, 'generate-demo-data.mjs');
      await import(`file://${demoScript}`);
      return;
    }
  }

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
        const maxPagesPerCategory = 25; // Fetch up to 25 pages (1250 beatmapsets) per category

        console.log(`\nScanning category: status="${status}", sort="${sort}"...`);

        while (pages < maxPagesPerCategory && collectedDifficulties.size < TARGET_POOL_SIZE * 1.2) {
          pages++;
          const data = await fetchBeatmapsets(token, sort, { status, cursor_string });
          const sets = data?.beatmapsets || [];

          if (sets.length === 0) break;

          for (const set of sets) {
            const beatmaps = set.beatmaps || [];
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
                playcount: b.playcount || 0,
                favouriteCount: set.favourite_count || 0,
                rankedDate: set.ranked_date,
                covers: {
                  cover: set.covers?.cover || `https://assets.ppy.sh/beatmaps/${set.id}/covers/cover.jpg`,
                  card: set.covers?.card || `https://assets.ppy.sh/beatmaps/${set.id}/covers/card.jpg`,
                  list: set.covers?.list || `https://assets.ppy.sh/beatmaps/${set.id}/covers/list.jpg`,
                  slimcover: set.covers?.slimcover || `https://assets.ppy.sh/beatmaps/${set.id}/covers/slimcover.jpg`,
                },
                previewUrl: set.preview_url ? `https:${set.preview_url}` : `https://b.ppy.sh/preview/${set.id}.mp3`,
                rawPlayLog: Math.log10(Math.max(1, b.playcount || 0)),
                rawFavLog: Math.log10(Math.max(1, set.favourite_count || 0)),
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

    // Compute popularity scores
    const withScores = calculatePopularity(allDifficulties);

    // Sort descending by popularity
    withScores.sort((a, b) => b.popularityScore - a.popularityScore);

    // Trim to top pool size
    const topPool = withScores.slice(0, TARGET_POOL_SIZE);

    // Assign rarity tiers based on percentiles
    const finalDataset = assignRarities(topPool);

    // Validate dataset
    validateDataset(finalDataset);

    // Write to atomic temp file first
    fs.writeFileSync(TEMP_FILE, JSON.stringify(finalDataset));

    // Calculate distribution statistics
    const rarityCounts = {
      Common: 0,
      Uncommon: 0,
      Rare: 0,
      Epic: 0,
      Legendary: 0,
      Mythic: 0,
      Divine: 0,
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

    console.log('\n Dataset successfully generated and written to public/data/maps.json');
    console.log('Rarity distribution:', rarityCounts);
  } catch (err) {
    if (fs.existsSync(TEMP_FILE)) {
      try {
        fs.unlinkSync(TEMP_FILE);
      } catch {}
    }
    console.error('Error updating beatmap dataset:', err);
    process.exit(1);
  }
}

main();
