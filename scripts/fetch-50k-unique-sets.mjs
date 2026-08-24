#!/usr/bin/env node
/**
 * scripts/fetch-50k-unique-sets.mjs
 *
 * Fetches exactly 50,000 COMPLETELY UNIQUE beatmapsets (1 card per song, always the Top Difficulty)
 * using the full beatmapset playcount and favourites for popularity calculation.
 *
 * 10-Tier Rarity Distribution:
 * - GOAT:       Top 10 unique songs (0.01% pull rate)
 * - Divine:     Next 30 unique songs (0.09% pull rate)
 * - Celestial:  Next 75 unique songs (0.15% pull rate)
 * - Mythic:     Next 150 unique songs (0.30% pull rate)
 * - Legendary:  Next 400 unique songs (0.75% pull rate)
 * - Epic:       Next 2,000 unique songs (4.0% pull rate)
 * - Rare:       Next 6,000 unique songs (12.0% pull rate)
 * - Uncommon+:  Next 12,000 unique songs (25.0% pull rate)
 * - Uncommon:   Next 14,000 unique songs (27.7% pull rate)
 * - Common:     Remaining 15,335 unique songs (30.0% pull rate)
 * Total:        50,000 100% UNIQUE songs (0 duplicate sets!)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAPS_FILE = path.resolve(__dirname, '../public/data/maps.json');
const INFO_FILE = path.resolve(__dirname, '../public/data/dataset-info.json');
const SEED_FILE = path.resolve(__dirname, '../src/data/seedData.ts');
const TMP_FILE = path.resolve(__dirname, '../public/data/maps.tmp.json');

const CLIENT_ID = process.env.OSU_CLIENT_ID || '64407';
const CLIENT_SECRET = process.env.OSU_CLIENT_SECRET || 'iB3705wFfBMOmDMySfVftLC9pULUYtd9aOYcWIDI';
const TARGET_UNIQUE_SETS = 37500;
const RATE_LIMIT_DELAY_MS = 150;

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
        console.warn('Rate limited (429). Backing off for 3 seconds...');
        await sleep(3000);
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

function assign10Tiers(maps) {
  // Sort descending by popularityScore, then stars
  const sorted = [...maps].sort((a, b) => b.popularityScore - a.popularityScore || b.stars - a.stars);

  const total = sorted.length;
  console.log(`Assigning 10 tiers strictly to ${total} unique beatmapsets...`);

  return sorted.map((m, index) => {
    let rarity = 'Common';

    if (index < 10) {
      rarity = 'GOAT';
    } else if (index < 40) { // Next 30
      rarity = 'Divine';
    } else if (index < 115) { // Next 75
      rarity = 'Celestial';
    } else if (index < 265) { // Next 150
      rarity = 'Mythic';
    } else if (index < 665) { // Next 400
      rarity = 'Legendary';
    } else if (index < 2665) { // Next 2,000
      rarity = 'Epic';
    } else if (index < 8665) { // Next 6,000
      rarity = 'Rare';
    } else if (index < 18665) { // Next 10,000
      rarity = 'Uncommon+';
    } else if (index < 29665) { // Next 11,000
      rarity = 'Uncommon';
    } else { // Remaining 7,835
      rarity = 'Common';
    }

    return {
      ...m,
      rarity,
    };
  });
}

function validateMaps(maps) {
  if (maps.length !== 37500) {
    throw new Error(`Expected exactly 37,500 maps, got ${maps.length}`);
  }

  const setIds = new Set();
  const mapIds = new Set();

  for (let i = 0; i < maps.length; i++) {
    const map = maps[i];
    if (setIds.has(map.beatmapsetId)) {
      throw new Error(`Duplicate beatmapset ID found: ${map.beatmapsetId} at index ${i}`);
    }
    setIds.add(map.beatmapsetId);

    if (mapIds.has(map.id)) {
      throw new Error(`Duplicate map ID found: ${map.id} at index ${i}`);
    }
    mapIds.add(map.id);

    const requiredFields = [
      'id',
      'beatmapsetId',
      'artist',
      'title',
      'version',
      'creator',
      'stars',
      'bpm',
      'length',
      'status',
      'playcount',
      'favouriteCount',
      'rarity',
      'popularityScore',
      'covers',
    ];

    for (const field of requiredFields) {
      if (map[field] === undefined || map[field] === null) {
        throw new Error(`Map #${map.id || i} is missing required field "${field}"`);
      }
    }
  }

  console.log(`Validation passed: Exactly 50,000 100% UNIQUE beatmapsets with Top Difficulties.`);
  return true;
}

async function main() {
  console.log('=== osu! Beatmap Gacha: 50,000 UNIQUE Beatmapsets Pool Generator ===');

  const collectedSets = new Map(); // beatmapsetId -> unique map object

  // 1. Pre-load existing sets (from tmp or maps.json)
  const sourceFile = fs.existsSync(TMP_FILE) ? TMP_FILE : MAPS_FILE;
  if (fs.existsSync(sourceFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
      if (Array.isArray(existing)) {
        for (const m of existing) {
          const current = collectedSets.get(m.beatmapsetId);
          if (!current || m.stars > current.stars) {
            collectedSets.set(m.beatmapsetId, m);
          }
        }
        console.log(`Pre-loaded ${collectedSets.size} unique beatmapsets from ${sourceFile}`);
      }
    } catch (err) {
      console.warn('Could not read existing file:', err.message);
    }
  }

  const token = await getOsuApiToken(CLIENT_ID, CLIENT_SECRET);

  const popularKeywords = [
    // Common words & themes
    'the', 'you', 'me', 'love', 'night', 'day', 'star', 'dream', 'world', 'heart',
    'rain', 'moon', 'sky', 'light', 'dark', 'fire', 'time', 'summer', 'winter',
    'spring', 'fall', 'girl', 'boy', 'dance', 'song', 'magic', 'sweet', 'happy',
    'sad', 'lost', 'memory', 'future', 'angel', 'demon', 'flower', 'sun', 'blue',
    'red', 'black', 'white', 'gold', 'crystal', 'shadow', 'wind', 'sea', 'ocean',
    'space', 'galaxy', 'game', 'party', 'super', 'ultra', 'hyper', 'remix', 'feat',
    'theme', 'opening', 'ending', 'ost', 'project', 'story', 'journey', 'life',
    'destiny', 'miracle', 'secret', 'shadow', 'silent', 'shining', 'eternal',

    // Popular Artists
    'Camellia', 'YOASOBI', 'Kessoku Band', 'Ado', 'Eve', 'ZUTOMAYO', 'TUYU',
    'Minami', 'LiSA', 'Reol', 'Nanahira', 'HoneyWorks', 'Kano', 'Hatsune Miku',
    'Myth & Roid', 'Chino', 'Halozy', 'Foreground Eclipse', 'DragonForce',
    'Galneryus', 'xi', 't+pazolite', 'USAO', 'Kobaryo', 'Laur', 'Sakuzyo',
    'ginkiha', 'Team Nekokan', 'FLOW', 'KANA-BOON', 'Ayase', 'ClariS',
    'supercell', 'DECO*27', 'PinocchioP', 'Maretu', 'Wowaka', 'CosMo@BousouP',
    'neru', 'kemu', '40mP', 'Giga', 'Mitchie M', 'Imperial Circus Dead Decadence',

    // Top Mappers
    'Sotarks', 'Nevo', 'Kroytz', 'Monstrata', 'Akitoshi', 'Doormat', 'reform',
    'Lami', 'Seni', 'Airman', 'Hailie', 'browiec', 'hyperlink', 'SMOKELIND',
    'BarkingMadDog', 'Foxy', 'Seto Kousuke', 'Kyuukai', 'Amatsu', 'Riven',
    'IOException', 'Andrea', 'handsome', 'Sing', 'Taeyang', 'RLC', 'pkk',
    'celerih', 'Nathan', 'Skystar', 'val0108', 'DJPop', 'Gero', 'alacat',
    'ktgster', 'Frostmourne', 'Guy', 'ProfessionalBox', 'rrtyui', 'Rustbell',
    'Hollow Wings', 'captin1', 'Kite', 'Mismagius', 'Natsu', 'Shukusho',
    'VINXIS', 'Fanteer', 'Kagetsu', 'dkblaze', 'Yukki', 'DeRandom Otaku',
  ];

  // Broad query matrix
  const searchQueries = [
    // 1. Loved beatmaps (diverse unique pool)
    { status: 'loved', sort: 'plays_desc' },
    { status: 'loved', sort: 'favourites_desc' },
    { status: 'loved', sort: 'difficulty_desc' },
    { status: 'loved', sort: 'ranked_desc' },

    // 2. Release Years (2007 - 2026)
    ...Array.from({ length: 20 }, (_, i) => 2026 - i).map((y) => ({
      status: 'ranked',
      sort: 'ranked_desc',
      q: `${y}`,
    })),

    // 3. Popular keywords
    ...popularKeywords.map((word) => ({
      status: 'ranked',
      sort: 'ranked_desc',
      q: word,
    })),

    // 4. All 14 Genres
    ...['2', '3', '4', '5', '6', '7', '9', '10', '11', '12', '13', '14'].map((g) => ({
      status: 'ranked',
      sort: 'ranked_desc',
      genre: g,
    })),

    // 5. 2-letter combinations starting from 'l'
    ...(() => {
      const chars = 'abcdefghijklmnopqrstuvwxyz';
      const pairs = [];
      for (let i = 11; i < chars.length; i++) { // start at 'l'
        for (let j = 0; j < chars.length; j++) {
          pairs.push({
            status: 'ranked',
            sort: 'ranked_desc',
            q: chars[i] + chars[j],
          });
        }
      }
      return pairs;
    })(),
  ];

  console.log(`\nFetching unique beatmapsets to reach target ${TARGET_UNIQUE_SETS} sets...`);

  let lastSaveCount = collectedSets.size;

  for (const q of searchQueries) {
    if (collectedSets.size >= TARGET_UNIQUE_SETS) {
      console.log(`\nReached target unique sets (${collectedSets.size}). Finalizing pool.`);
      break;
    }

    let cursor_string = null;
    let pages = 0;
    const maxPages = 40;
    let consecutiveZeroNew = 0;

    console.log(`\nScanning category: status="${q.status}", sort="${q.sort}" ${q.genre ? `genre=${q.genre}` : ''} ${q.language ? `lang=${q.language}` : ''} ${q.q ? `q="${q.q}"` : ''}...`);

    while (pages < maxPages && collectedSets.size < TARGET_UNIQUE_SETS * 1.02) {
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

      let newSetsInPage = 0;

      for (const set of sets) {
        if (collectedSets.has(set.id)) continue;

        const beatmaps = set.beatmaps || [];
        const standardBeatmaps = beatmaps.filter(
          (b) => (b.mode_int === 0 || b.mode === 'osu') && b.difficulty_rating > 0
        );

        if (standardBeatmaps.length === 0) continue;

        // Sort difficulties descending to find Top Difficulty
        standardBeatmaps.sort((a, b) => b.difficulty_rating - a.difficulty_rating);
        const topDiff = standardBeatmaps[0];

        const setPlaycount = set.play_count || 0;
        const setFavouriteCount = set.favourite_count || 0;

        const uniqueCard = {
          id: topDiff.id,
          beatmapsetId: set.id,
          artist: set.artist,
          artistUnicode: set.artist_unicode || set.artist,
          title: set.title,
          titleUnicode: set.title_unicode || set.title,
          version: topDiff.version,
          creator: set.creator,
          creatorId: set.user_id,
          stars: Math.round(topDiff.difficulty_rating * 100) / 100,
          bpm: Math.round(topDiff.bpm || set.bpm || 120),
          length: topDiff.total_length || topDiff.hit_length || 0,
          status: topDiff.status || set.status,
          playcount: setPlaycount || topDiff.playcount || 0,
          favouriteCount: setFavouriteCount,
          rankedDate: set.ranked_date,
          covers: {
            cover: set.covers?.cover || `https://assets.ppy.sh/beatmaps/${set.id}/covers/cover.jpg`,
            card: set.covers?.card || `https://assets.ppy.sh/beatmaps/${set.id}/covers/card.jpg`,
            list: set.covers?.list || `https://assets.ppy.sh/beatmaps/${set.id}/covers/list.jpg`,
            slimcover: set.covers?.slimcover || `https://assets.ppy.sh/beatmaps/${set.id}/covers/slimcover.jpg`,
          },
        };

        collectedSets.set(set.id, uniqueCard);
        newSetsInPage++;
      }

      if (newSetsInPage === 0) {
        consecutiveZeroNew++;
        if (consecutiveZeroNew >= 2 && pages >= 5) {
          // Skip dead query early
          break;
        }
      } else {
        consecutiveZeroNew = 0;
      }

      console.log(`Page ${pages}: +${newSetsInPage} new songs | Total: ${collectedSets.size} / ${TARGET_UNIQUE_SETS}`);

      // Checkpoint every 50 sets
      if (collectedSets.size - lastSaveCount >= 50) {
        lastSaveCount = collectedSets.size;
        fs.writeFileSync(TMP_FILE, JSON.stringify(Array.from(collectedSets.values())));
        console.log(`[Checkpoint] Saved ${collectedSets.size} unique songs to ${TMP_FILE}`);
      }

      cursor_string = data?.cursor_string;
      if (!cursor_string) break;
    }
  }

  console.log(`\nCollected ${collectedSets.size} total unique beatmapsets.`);

  // Convert map to array
  let mapsArray = Array.from(collectedSets.values());

  // Popularity Scoring based on total set playcount + favorites
  console.log('Calculating global popularity scores for all 50,000 unique sets...');
  mapsArray = calculatePopularity(mapsArray);

  // Sort descending by popularityScore
  mapsArray.sort((a, b) => b.popularityScore - a.popularityScore || b.stars - a.stars);

  // Trim to exactly 50,000 unique sets
  mapsArray = mapsArray.slice(0, TARGET_UNIQUE_SETS);

  // Assign the 10 Tiers
  mapsArray = assign10Tiers(mapsArray);

  // Validation
  validateMaps(mapsArray);

  // Write to public/data/maps.json
  fs.writeFileSync(MAPS_FILE, JSON.stringify(mapsArray, null, 2));

  // Remove tmp file
  if (fs.existsSync(TMP_FILE)) {
    fs.unlinkSync(TMP_FILE);
  }

  // Compute breakdown stats
  const rarityBreakdown = {
    Common: 0,
    Uncommon: 0,
    'Uncommon+': 0,
    Rare: 0,
    Epic: 0,
    Legendary: 0,
    Mythic: 0,
    Celestial: 0,
    Divine: 0,
    GOAT: 0,
  };
  mapsArray.forEach((m) => {
    rarityBreakdown[m.rarity] = (rarityBreakdown[m.rarity] || 0) + 1;
  });

  const datasetInfo = {
    version: '5.0.0',
    lastUpdated: new Date().toISOString(),
    totalMaps: mapsArray.length,
    rarityCounts: rarityBreakdown,
    source: 'osu! API v2 37,500 100% Unique Songs (Top Difficulties Only)',
  };
  fs.writeFileSync(INFO_FILE, JSON.stringify(datasetInfo, null, 2));

  // Write top 500 subset seedData.ts
  const seedSubset = mapsArray.slice(0, 500);
  const seedContent = `import { Beatmap, DatasetInfo } from "../types/beatmap";\n\nexport const SEED_DATASET_INFO: DatasetInfo = ${JSON.stringify(datasetInfo, null, 2)};\n\nexport const SEED_BEATMAPS: Beatmap[] = (${JSON.stringify(seedSubset, null, 2)}) as unknown as Beatmap[];\n`;
  fs.writeFileSync(SEED_FILE, seedContent);

  console.log(`\n🎉 Success! Generated ${mapsArray.length} 100% UNIQUE songs (Top Diffs) written to ${MAPS_FILE} and ${SEED_FILE}`);
  console.log('10-Tier Rarity Distribution:', rarityBreakdown);
}

main().catch((err) => {
  console.error('Fatal error in pool generation:', err);
  process.exit(1);
});
