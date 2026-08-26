#!/usr/bin/env node
/**
 * scripts/local-scraper.mjs
 *
 * Local Beatmap Scraper for osu! Beatmap Gacha
 *
 * Design:
 * - Strictly 1 card per song (1 difficulty per unique beatmapset — top difficulty selected).
 * - 0 duplicate songs / 0 duplicate sets.
 * - Crawls 100% of all ranked & loved beatmapsets in osu! standard history (~38k–43k songs).
 * - Interactive or .env credential loading (OSU_CLIENT_ID & OSU_CLIENT_SECRET).
 * - Resilient auto-resume from checkpoint (public/data/scraper-checkpoint.json).
 * - Dynamic percentile-based 10-Tier Pyramid Rarity classification.
 * - Compiles public/data/maps.json, public/data/dataset-info.json, and src/data/seedData.ts.
 *
 * Usage:
 *   npm run scrape
 *   or
 *   node scripts/local-scraper.mjs
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target Paths
const MAPS_FILE = path.resolve(__dirname, '../public/data/maps.json');
const INFO_FILE = path.resolve(__dirname, '../public/data/dataset-info.json');
const SEED_FILE = path.resolve(__dirname, '../src/data/seedData.ts');
const CHECKPOINT_FILE = path.resolve(__dirname, '../public/data/scraper-checkpoint.json');
const ENV_FILE = path.resolve(__dirname, '../.env');
const ENV_LOCAL_FILE = path.resolve(__dirname, '../.env.local');

const RATE_LIMIT_DELAY_MS = 140; // osu! API rate limit delay

// Helper to sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Simple .env parser
function loadEnv() {
  for (const envPath of [ENV_LOCAL_FILE, ENV_FILE]) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...vals] = trimmed.split('=');
          const k = key.trim();
          const v = vals.join('=').trim().replace(/^["']|["']$/g, '');
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    }
  }
}

// Ask user interactively via CLI prompt
function promptUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

// Authenticate with osu! API v2
async function getOsuToken(clientId, clientSecret) {
  console.log('🔑 Authenticating with osu! API v2 OAuth...');
  const res = await fetch('https://osu.ppy.sh/oauth/token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
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
  console.log('✅ Authentication successful!\n');
  return data.access_token;
}

// Fetch beatmapsets search page from osu! API
async function fetchBeatmapsets(token, sort = 'plays_desc', queryParams = {}) {
  const url = new URL('https://osu.ppy.sh/api/v2/beatmapsets/search');
  url.searchParams.set('sort', sort);
  url.searchParams.set('s', queryParams.status || 'ranked');
  url.searchParams.set('m', '0'); // osu! standard only

  if (queryParams.genre) url.searchParams.set('g', queryParams.genre);
  if (queryParams.language) url.searchParams.set('l', queryParams.language);
  if (queryParams.q) url.searchParams.set('q', queryParams.q);
  if (queryParams.cursor_string) url.searchParams.set('cursor_string', queryParams.cursor_string);

  let retries = 4;
  while (retries > 0) {
    try {
      await sleep(RATE_LIMIT_DELAY_MS);
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 429) {
        console.warn('⚠️ Rate limited (429). Pausing for 3.5 seconds...');
        await sleep(3500);
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
  return { beatmapsets: [], cursor_string: null };
}

// Extract top difficulty from a beatmapset (strictly 1 card per song)
function processBeatmapset(set) {
  if (!set || !set.beatmaps || set.beatmaps.length === 0) return null;

  // Filter strictly to osu! standard (mode_int === 0 or mode === 'osu')
  const stdMaps = set.beatmaps.filter((b) => b.mode_int === 0 || b.mode === 'osu');
  if (stdMaps.length === 0) return null;

  // Pick difficulty with highest star rating (Top Difficulty)
  const topDiff = stdMaps.reduce((prev, curr) =>
    (curr.difficulty_rating || 0) > (prev.difficulty_rating || 0) ? curr : prev
  );

  const totalPlays = set.play_count || stdMaps.reduce((sum, b) => sum + (b.playcount || 0), 0);
  const totalFavs = set.favourite_count || 0;
  const status = (set.status || 'ranked').toLowerCase();

  // Graveyarded / Pending maps condition: ONLY include if plays exceed 250k!
  const isGraveyardOrUnranked =
    status === 'graveyard' || status === 'pending' || status === 'wip' || status === 'unranked';
  if (isGraveyardOrUnranked && totalPlays < 250000) {
    return null; // Exclude graveyarded maps with less than 250k plays
  }

  const popularityScore = totalPlays * 0.6 + totalFavs * 400;

  // Cover artwork URL
  let coverUrl =
    set.covers?.cover ||
    set.covers?.['cover@2x'] ||
    `https://assets.ppy.sh/beatmaps/${set.id}/covers/cover.jpg`;

  if (coverUrl.startsWith('//')) coverUrl = `https:${coverUrl}`;

  // Audio preview URL
  let previewUrl = set.preview_url || `//b.ppy.sh/preview/${set.id}.mp3`;
  if (previewUrl.startsWith('//')) previewUrl = `https:${previewUrl}`;

  // Normalized Beatmap Object (1 card per unique song set)
  return {
    id: topDiff.id,
    setId: set.id,
    title: set.title || 'Unknown Title',
    artist: set.artist || 'Unknown Artist',
    creator: set.creator || 'Unknown Mapper',
    version: topDiff.version || 'Normal',
    stars: Math.round((topDiff.difficulty_rating || 0) * 100) / 100,
    bpm: set.bpm || topDiff.bpm || 120,
    length: topDiff.total_length || 0,
    ar: topDiff.ar || 8,
    cs: topDiff.cs || 4,
    hp: topDiff.drain || 5,
    od: topDiff.accuracy || 8,
    passcount: topDiff.passcount || 0,
    playcount: totalPlays,
    favourite_count: totalFavs,
    popularityScore: Math.round(popularityScore),
    status: isGraveyardOrUnranked ? 'graveyard' : status,
    rankedDate: set.ranked_date || set.submitted_date || null,
    genre: set.genre?.name || 'Unspecified',
    language: set.language?.name || 'Unspecified',
    tags: set.tags ? set.tags.split(' ').slice(0, 10).join(' ') : '',
    coverUrl,
    previewUrl,
    rarity: 'Common', // Assigned post-crawl
  };
}

// 10-Tier Pyramid Classifier (Dynamic Percentile Distribution)
function assignRarities(maps) {
  // Sort descending by popularity score
  maps.sort((a, b) => b.popularityScore - a.popularityScore);

  const total = maps.length;
  console.log(`\n⚖️ Classifying ${total.toLocaleString()} unique songs into 10 Rarity Tiers...`);

  // Target tier distribution counts
  const goatCount = 10;
  const divineCount = Math.max(20, Math.round(total * 0.0008));      // ~30 maps
  const celestialCount = Math.max(50, Math.round(total * 0.002));   // ~80 maps
  const mythicCount = Math.max(100, Math.round(total * 0.004));     // ~160 maps
  const legendaryCount = Math.max(300, Math.round(total * 0.01));   // ~400 maps
  const epicCount = Math.max(1500, Math.round(total * 0.05));       // ~2,000 maps
  const rareCount = Math.max(5000, Math.round(total * 0.15));       // ~6,000 maps
  const uncommonPlusCount = Math.max(10000, Math.round(total * 0.28)); // ~11,000 maps
  const uncommonCount = Math.max(10000, Math.round(total * 0.28));     // ~11,000 maps

  const TIERS = [
    { tier: 'GOAT', count: goatCount },
    { tier: 'Divine', count: divineCount },
    { tier: 'Celestial', count: celestialCount },
    { tier: 'Mythic', count: mythicCount },
    { tier: 'Legendary', count: legendaryCount },
    { tier: 'Epic', count: epicCount },
    { tier: 'Rare', count: rareCount },
    { tier: 'Uncommon+', count: uncommonPlusCount },
    { tier: 'Uncommon', count: uncommonCount },
  ];

  let currentIndex = 0;
  for (const { tier, count } of TIERS) {
    const end = Math.min(currentIndex + count, total);
    for (let i = currentIndex; i < end; i++) {
      maps[i].rarity = tier;
    }
    currentIndex = end;
  }

  // All remaining songs become Common
  for (let i = currentIndex; i < total; i++) {
    maps[i].rarity = 'Common';
  }

  // Distribution audit
  const dist = {};
  for (const m of maps) {
    dist[m.rarity] = (dist[m.rarity] || 0) + 1;
  }

  console.log('📊 Rarity Distribution Breakdown:');
  for (const [tier, cnt] of Object.entries(dist)) {
    const pct = ((cnt / maps.length) * 100).toFixed(2);
    console.log(`  - ${tier.padEnd(12)}: ${cnt.toLocaleString().padStart(6)} (${pct}%)`);
  }

  return maps;
}

// Main Scraper Execution
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎵 osu! Beatmap Gacha — 1-Song-1-Card Database Scraper');
  console.log('═══════════════════════════════════════════════════════════════\n');

  loadEnv();

  let clientId = process.env.OSU_CLIENT_ID;
  let clientSecret = process.env.OSU_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('ℹ️ osu! API v2 credentials not detected in environment.');
    console.log('👉 Create OAuth app at: https://osu.ppy.sh/home/account/edit#oauth\n');
    clientId = await promptUser('Enter osu! Client ID: ');
    clientSecret = await promptUser('Enter osu! Client Secret: ');
  }

  if (!clientId || !clientSecret) {
    console.error('❌ Error: Both Client ID and Client Secret are required.');
    process.exit(1);
  }

  const token = await getOsuToken(clientId, clientSecret);

  // Map collection keyed by beatmapset ID (STRICTLY 1 card per song set)
  const mapPool = new Map();

  // 1. Pre-seed with existing maps.json if present (37k+ base)
  if (fs.existsSync(MAPS_FILE)) {
    try {
      const existingMaps = JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8'));
      if (Array.isArray(existingMaps)) {
        for (const m of existingMaps) {
          const sId = m.setId || m.beatmapsetId;
          if (sId) {
            mapPool.set(sId, {
              ...m,
              setId: sId,
              coverUrl: m.coverUrl || m.covers?.cover || `https://assets.ppy.sh/beatmaps/${sId}/covers/cover.jpg`,
              favourite_count: m.favourite_count || m.favouriteCount || 0,
            });
          }
        }
        console.log(`📦 Loaded ${mapPool.size.toLocaleString()} existing unique songs from public/data/maps.json!`);
      }
    } catch (e) {
      console.warn('⚠️ Could not load maps.json, starting fresh.');
    }
  }

  // 2. Also layer any additional checkpoint progress
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const checkpointMaps = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      if (Array.isArray(checkpointMaps)) {
        let addedFromCheckpoint = 0;
        for (const m of checkpointMaps) {
          const sId = m.setId || m.beatmapsetId;
          if (sId && !mapPool.has(sId)) {
            mapPool.set(sId, {
              ...m,
              setId: sId,
              coverUrl: m.coverUrl || m.covers?.cover || `https://assets.ppy.sh/beatmaps/${sId}/covers/cover.jpg`,
              favourite_count: m.favourite_count || m.favouriteCount || 0,
            });
            addedFromCheckpoint++;
          }
        }
        if (addedFromCheckpoint > 0) {
          console.log(`📂 Added ${addedFromCheckpoint.toLocaleString()} extra songs from checkpoint!`);
        }
      }
    } catch {
      console.warn('⚠️ Checkpoint file corrupted.');
    }
  }

  console.log(`🚀 Base pool ready: ${mapPool.size.toLocaleString()} unique songs in memory!\n`);

  // Multi-dimensional search plan to crawl 100% of all ranked & loved sets
  const searchQueries = [];

  // 1. Popular sortings (Ranked & Loved)
  for (const status of ['ranked', 'loved']) {
    for (const sort of ['plays_desc', 'favourites_desc', 'ranked_desc', 'difficulty_desc', 'rating_desc', 'updated_desc']) {
      searchQueries.push({ status, sort, label: `${status} / ${sort}` });
    }
  }

  // 2. Genres breakdown (1 = Unspecified, 2 = Video Game, 3 = Anime, 4 = Rock, 5 = Pop, 6 = Other, 7 = Novelty, 9 = Hip Hop, 10 = Electronic, 11 = Metal, 12 = Classical, 13 = Folk, 14 = Jazz)
  for (let g = 1; g <= 14; g++) {
    for (const sort of ['plays_desc', 'favourites_desc', 'ranked_desc']) {
      searchQueries.push({ genre: g, sort, status: 'ranked', label: `Genre ${g} / ${sort}` });
    }
  }

  // 3. Languages breakdown (2 = English, 3 = Japanese, 4 = Chinese, 5 = Instrumental, 6 = Korean, 7 = French, 8 = German, 9 = Swedish, 10 = Spanish, 11 = Italian, 12 = Russian, 13 = Polish, 14 = Other)
  for (let l = 2; l <= 14; l++) {
    for (const sort of ['plays_desc', 'favourites_desc', 'ranked_desc']) {
      searchQueries.push({ language: l, sort, status: 'ranked', label: `Lang ${l} / ${sort}` });
    }
  }

  // 4. Chronological year queries (2007 through 2026)
  for (let year = 2007; year <= 2026; year++) {
    for (const sort of ['plays_desc', 'favourites_desc', 'ranked_desc']) {
      searchQueries.push({ q: `${year}`, sort, status: 'ranked', label: `Year ${year} / ${sort}` });
    }
  }

  // 5. Graveyarded & Pending maps (Top plays & Top Favourites with >=250k plays)
  for (const status of ['graveyard', 'pending']) {
    for (const sort of ['plays_desc', 'favourites_desc']) {
      searchQueries.push({ status, sort, label: `${status} (>=250k plays) / ${sort}` });
    }
  }

  // 6. Letter search prefixes
  const letters = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
  for (const letter of letters) {
    searchQueries.push({ q: letter, sort: 'plays_desc', status: 'ranked', label: `Letter ${letter}` });
  }

  console.log(`📋 Total Crawl Strategy Queues: ${searchQueries.length}`);
  console.log(`🎯 Collecting 100% of all unique ranked, loved, & popular graveyarded (>=250k plays) song sets...\n`);

  const startTime = Date.now();
  let lastSaveCount = mapPool.size;

  for (let qIdx = 0; qIdx < searchQueries.length; qIdx++) {
    const plan = searchQueries[qIdx];
    let cursor_string = null;
    let page = 0;
    let newInQueue = 0;

    process.stdout.write(`\r[Queue ${qIdx + 1}/${searchQueries.length}] Crawling ${plan.label}... `);

    while (page < 200) {
      const data = await fetchBeatmapsets(token, plan.sort, {
        status: plan.status,
        genre: plan.genre,
        language: plan.language,
        q: plan.q,
        cursor_string,
      });

      if (!data || !data.beatmapsets || data.beatmapsets.length === 0) break;

      for (const set of data.beatmapsets) {
        const sId = set.id;
        if (sId && !mapPool.has(sId)) {
          const map = processBeatmapset(set);
          if (map) {
            mapPool.set(sId, map);
            newInQueue++;
          }
        }
      }

      cursor_string = data.cursor_string;
      page++;

      const elapsedSec = (Date.now() - startTime) / 1000;
      const rate = (mapPool.size / Math.max(1, elapsedSec)).toFixed(1);
      process.stdout.write(
        `\r[Queue ${qIdx + 1}/${searchQueries.length}] ${plan.label} | Total Unique: ${mapPool.size.toLocaleString()} (+${newInQueue} in queue) [${rate} maps/s]`
      );

      // Auto-save checkpoint every 250 new maps
      if (mapPool.size - lastSaveCount >= 250) {
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(Array.from(mapPool.values())));
        lastSaveCount = mapPool.size;
      }

      if (!cursor_string) break;
    }
  }

  const finalMaps = Array.from(mapPool.values());
  console.log(`\n\n✨ Crawl completed! Total 100% unique song sets fetched: ${finalMaps.length.toLocaleString()}`);

  // Classify and sort
  const classifiedMaps = assignRarities(finalMaps);

  // 1. Write public/data/maps.json
  console.log('\n💾 Writing public/data/maps.json...');
  fs.writeFileSync(MAPS_FILE, JSON.stringify(classifiedMaps));
  const fileSizeMb = (fs.statSync(MAPS_FILE).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Saved ${classifiedMaps.length.toLocaleString()} unique songs (${fileSizeMb} MB) to maps.json`);

  // 2. Write dataset-info.json
  console.log('💾 Writing public/data/dataset-info.json...');
  const rarityCounts = {};
  for (const m of classifiedMaps) {
    rarityCounts[m.rarity] = (rarityCounts[m.rarity] || 0) + 1;
  }
  const datasetInfo = {
    totalMaps: classifiedMaps.length,
    lastUpdated: new Date().toISOString(),
    version: '2.5.0',
    rarityCounts,
    source: 'osu! API v2 Ranked & Loved Standard (1 Card Per Song)',
  };
  fs.writeFileSync(INFO_FILE, JSON.stringify(datasetInfo, null, 2));

  // 3. Write top 100 to src/data/seedData.ts
  console.log('💾 Writing src/data/seedData.ts (Top 100 Featured Cards)...');
  const top100 = classifiedMaps.slice(0, 100);
  const seedContent = `import { Beatmap } from '../types/beatmap';\n\nexport const SEED_BEATMAPS: Beatmap[] = ${JSON.stringify(top100, null, 2)};\n`;
  fs.writeFileSync(SEED_FILE, seedContent);

  // Clean up checkpoint
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎉 1-SONG-1-CARD BEATMAP DATASET COMPILED & READY FOR SUMMONS!');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal Scraper Error:', err);
  process.exit(1);
});
